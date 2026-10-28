import express from 'express'
import multer from 'multer'
import path from 'node:path'
import fs from 'node:fs'
import { PrismaClient } from '@prisma/client'
import { z } from 'zod'
import { calculateScore, generateDemoQuestion, packageReadinessIssue, toPublicQuizQuestion, validateOptions } from './domain.js'
import { seedDemo } from '../prisma/seed.js'

export const prisma = new PrismaClient()
export const app = express()
const port = Number(process.env.API_PORT || 4000)
const uploadDirectory = path.resolve('uploads')
fs.mkdirSync(uploadDirectory, { recursive: true })

app.use(express.json({ limit: '1mb' }))
app.use('/uploads', express.static(uploadDirectory))

const fullQuestion = {
  educationLevel: true,
  subject: true,
  topic: true,
  options: { orderBy: { sortOrder: 'asc' as const } },
  media: { include: { mediaAsset: true } },
}

const writeAudit = (action: string, entityType: string, entityId: string, details?: string) =>
  prisma.auditLog.create({ data: { actorRole: 'TEACHER', action, entityType, entityId, details } })

const demoteReadyPackages = (questionId: string) => prisma.questionPackage.updateMany({
  where: { status: 'READY', questions: { some: { questionId } } },
  data: { status: 'DRAFT' },
})

const questionInput = z.object({
  questionText: z.string().min(8),
  educationLevelId: z.string(),
  grade: z.string().min(1),
  subjectId: z.string(),
  topicId: z.string(),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  mediaNeed: z.enum(['NOT_CHECKED', 'NOT_REQUIRED', 'REQUIRED', 'CANDIDATE_AVAILABLE', 'LINKED', 'FAILED']),
  mediaExclusionNote: z.string().optional(),
  options: z.array(z.object({
    label: z.string().min(1).max(1),
    text: z.string().min(1),
    isCorrect: z.boolean(),
    explanation: z.string().min(1),
  })).min(4).max(5),
}).superRefine((value, context) => {
  if (!validateOptions(value.options.map((option, sortOrder) => ({ ...option, sortOrder })))) {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Opsi harus unik, memiliki tepat satu jawaban benar, dan penjelasan lengkap.' })
  }
  if (value.mediaNeed === 'NOT_REQUIRED' && !value.mediaExclusionNote?.trim()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['mediaExclusionNote'], message: 'Alasan pengecualian media wajib diisi.' })
  }
})

const generatorInput = z.object({
  educationLevelId: z.string(),
  grade: z.string().min(1),
  subjectId: z.string(),
  topicId: z.string(),
  count: z.number().int().min(1).max(10),
  difficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),
  optionCount: z.union([z.literal(4), z.literal(5)]),
  media: z.enum(['AUTO', 'YES', 'NO']),
  additionalInstruction: z.string().max(500).optional(),
})

const packageInput = z.object({
  title: z.string().min(3),
  description: z.string().optional(),
  packageType: z.string().min(2).default('PRACTICE'),
  educationLevelId: z.string(),
  grade: z.string().min(1),
  subjectId: z.string(),
  questionIds: z.array(z.string()).default([]),
})

app.get('/api/health', (_request, response) => response.json({ status: 'ok', storage: 'sqlite-local' }))
app.get('/api/demo/status', (_request, response) => response.json({ demoMode: true, providers: ['AI soal', 'AI media', 'email', 'WhatsApp', 'pembayaran'] }))

app.get('/api/dashboard/summary', async (_request, response, next) => {
  try {
    const [total, draft, review, validated, rejected, mediaNeeded, packages, readyPackages, attempts, recent] = await Promise.all([
      prisma.question.count({ where: { status: { not: 'ARCHIVED' } } }),
      prisma.question.count({ where: { status: 'DRAFT' } }),
      prisma.question.count({ where: { status: 'NEEDS_REVIEW' } }),
      prisma.question.count({ where: { status: 'VALIDATED' } }),
      prisma.question.count({ where: { status: 'REJECTED' } }),
      prisma.question.count({ where: { mediaNeed: 'REQUIRED' } }),
      prisma.questionPackage.count({ where: { status: { not: 'ARCHIVED' } } }),
      prisma.questionPackage.count({ where: { status: 'READY' } }),
      prisma.quizAttempt.count(),
      prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 6 }),
    ])
    response.json({ total, draft, review, validated, rejected, mediaNeeded, packages, readyPackages, attempts, recent })
  } catch (error) { next(error) }
})

app.get('/api/audit-logs', async (request, response, next) => {
  try {
    const search = String(request.query.search || '')
    const records = await prisma.auditLog.findMany({
      where: search ? { OR: [
        { action: { contains: search } },
        { entityType: { contains: search } },
        { entityId: { contains: search } },
        { details: { contains: search } },
      ] } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    response.json(records)
  } catch (error) { next(error) }
})

app.get('/api/master/:kind', async (request, response, next) => {
  try {
    const kind = request.params.kind
    if (kind === 'education-levels') return response.json(await prisma.educationLevel.findMany({ orderBy: { name: 'asc' } }))
    if (kind === 'subjects') return response.json(await prisma.subject.findMany({ orderBy: { name: 'asc' } }))
    if (kind === 'topics') return response.json(await prisma.topic.findMany({ include: { subject: true }, orderBy: { name: 'asc' } }))
    if (kind === 'package-types') return response.json(await prisma.packageType.findMany({ orderBy: { name: 'asc' } }))
    return response.status(404).json({ error: 'Data master tidak ditemukan.' })
  } catch (error) { next(error) }
})

app.post('/api/master/:kind', async (request, response, next) => {
  try {
    const body = z.object({ name: z.string().trim().min(2).regex(/[A-Za-z0-9]/), subjectId: z.string().optional() }).parse(request.body)
    const kind = request.params.kind
    const record = kind === 'education-levels'
      ? await prisma.educationLevel.create({ data: { name: body.name } })
      : kind === 'subjects'
        ? await prisma.subject.create({ data: { name: body.name } })
        : kind === 'topics' && body.subjectId
          ? await prisma.topic.create({ data: { name: body.name, subjectId: body.subjectId } })
          : kind === 'package-types'
            ? await prisma.packageType.create({ data: {
              name: body.name,
              code: body.name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]+/g, '_').replace(/^_|_$/g, ''),
            } })
            : null
    if (!record) return response.status(400).json({ error: 'Jenis data master atau subjectId tidak valid.' })
    response.status(201).json(record)
  } catch (error) { next(error) }
})

app.patch('/api/master/:kind/:id', async (request, response, next) => {
  try {
    const { name } = z.object({ name: z.string().trim().min(2) }).parse(request.body)
    const { kind, id } = request.params
    const record = kind === 'education-levels'
      ? await prisma.educationLevel.update({ where: { id }, data: { name } })
      : kind === 'subjects'
        ? await prisma.subject.update({ where: { id }, data: { name } })
        : kind === 'topics'
          ? await prisma.topic.update({ where: { id }, data: { name } })
          : kind === 'package-types'
            ? await prisma.packageType.update({ where: { id }, data: { name } })
            : null
    if (!record) return response.status(404).json({ error: 'Data master tidak ditemukan.' })
    response.json(record)
  } catch (error) { next(error) }
})

app.delete('/api/master/:kind/:id', async (request, response, next) => {
  try {
    const { kind, id } = request.params
    if (kind === 'education-levels') await prisma.educationLevel.delete({ where: { id } })
    else if (kind === 'subjects') await prisma.subject.delete({ where: { id } })
    else if (kind === 'topics') await prisma.topic.delete({ where: { id } })
    else if (kind === 'package-types') await prisma.packageType.delete({ where: { id } })
    else return response.status(404).json({ error: 'Data master tidak ditemukan.' })
    response.status(204).end()
  } catch (error) { next(error) }
})

app.get('/api/questions', async (request, response, next) => {
  try {
    const search = String(request.query.search || '')
    const status = String(request.query.status || '')
    const subjectId = String(request.query.subjectId || '')
    const educationLevelId = String(request.query.educationLevelId || '')
    const topicId = String(request.query.topicId || '')
    const mediaNeed = String(request.query.mediaNeed || '')
    const rows = await prisma.question.findMany({
      where: {
        ...(status ? { status } : {}),
        ...(subjectId ? { subjectId } : {}),
        ...(educationLevelId ? { educationLevelId } : {}),
        ...(topicId ? { topicId } : {}),
        ...(mediaNeed ? { mediaNeed } : {}),
        ...(search ? { questionText: { contains: search } } : {}),
      },
      include: fullQuestion,
      orderBy: { updatedAt: 'desc' },
    })
    response.json(rows)
  } catch (error) { next(error) }
})

app.get('/api/questions/:id', async (request, response, next) => {
  try {
    const question = await prisma.question.findUnique({ where: { id: request.params.id }, include: fullQuestion })
    if (!question) return response.status(404).json({ error: 'Soal tidak ditemukan.' })
    response.json(question)
  } catch (error) { next(error) }
})

app.post('/api/questions', async (request, response, next) => {
  try {
    const data = questionInput.parse(request.body)
    const question = await prisma.question.create({
      data: {
        ...data,
        status: 'NEEDS_REVIEW',
        sourceType: 'INTERNAL',
        options: { create: data.options.map((option, sortOrder) => ({ ...option, sortOrder })) },
      },
      include: fullQuestion,
    })
    await writeAudit('QUESTION_CREATED', 'Question', question.id)
    response.status(201).json(question)
  } catch (error) { next(error) }
})

app.patch('/api/questions/:id', async (request, response, next) => {
  try {
    const data = questionInput.parse(request.body)
    const previous = await prisma.question.findUnique({ where: { id: request.params.id }, include: { options: { orderBy: { sortOrder: 'asc' } } } })
    if (!previous) return response.status(404).json({ error: 'Soal tidak ditemukan.' })
    const question = await prisma.$transaction(async (transaction) => {
      const updated = await transaction.question.update({
        where: { id: previous.id },
        data: {
          questionText: data.questionText,
          educationLevelId: data.educationLevelId,
          grade: data.grade,
          subjectId: data.subjectId,
          topicId: data.topicId,
          difficulty: data.difficulty,
          mediaNeed: data.mediaNeed,
          mediaExclusionNote: data.mediaExclusionNote,
          status: previous.status === 'VALIDATED' ? 'NEEDS_REVIEW' : previous.status,
          validatedAt: previous.status === 'VALIDATED' ? null : previous.validatedAt,
        },
      })
      await Promise.all(data.options.map((option, sortOrder) => {
        const existing = previous.options[sortOrder]
        return existing
          ? transaction.answerOption.update({ where: { id: existing.id }, data: { ...option, sortOrder } })
          : transaction.answerOption.create({ data: { ...option, sortOrder, questionId: previous.id } })
      }))
      await transaction.answerOption.deleteMany({ where: { questionId: previous.id, sortOrder: { gte: data.options.length } } })
      await transaction.questionPackage.updateMany({ where: { questions: { some: { questionId: previous.id } }, status: 'READY' }, data: { status: 'DRAFT' } })
      return transaction.question.findUniqueOrThrow({ where: { id: updated.id }, include: fullQuestion })
    })
    await writeAudit('QUESTION_EDITED', 'Question', question.id)
    response.json(question)
  } catch (error) { next(error) }
})

app.post('/api/ai/generate-questions', async (request, response, next) => {
  try {
    const input = generatorInput.parse(request.body)
    const [level, subject, topic, teacher] = await Promise.all([
      prisma.educationLevel.findUnique({ where: { id: input.educationLevelId } }),
      prisma.subject.findUnique({ where: { id: input.subjectId } }),
      prisma.topic.findUnique({ where: { id: input.topicId } }),
      prisma.user.findFirst({ where: { role: 'TEACHER' } }),
    ])
    if (!level || !subject || !topic || topic.subjectId !== subject.id) return response.status(400).json({ error: 'Taksonomi tidak valid.' })
    const created = await Promise.all(Array.from({ length: input.count }, async (_unused, index) => {
      const generated = generateDemoQuestion({
        educationLevel: level.name,
        grade: input.grade,
        subject: subject.name,
        topic: topic.name,
        difficulty: input.difficulty,
        optionCount: input.optionCount,
        additionalInstruction: input.additionalInstruction,
      }, index)
      const mediaNeed = input.media === 'YES' ? 'REQUIRED' : input.media === 'NO' ? 'NOT_REQUIRED' : generated.mediaNeed
      return prisma.question.create({
        data: {
          questionText: generated.questionText,
          educationLevelId: level.id,
          grade: input.grade,
          subjectId: subject.id,
          topicId: topic.id,
          difficulty: input.difficulty,
          mediaNeed,
          mediaExclusionNote: mediaNeed === 'NOT_REQUIRED' ? 'Dikecualikan oleh pengaturan generator demo.' : null,
          status: 'NEEDS_REVIEW',
          sourceType: 'AI_GENERATED',
          createdById: teacher?.id,
          options: { create: generated.options.slice(0, input.optionCount) },
        },
        include: fullQuestion,
      })
    }))
    await writeAudit('QUESTIONS_GENERATED', 'Question', created.map((question) => question.id).join(','), 'Demo generator')
    response.status(201).json({ mode: 'DEMO', questions: created })
  } catch (error) { next(error) }
})

app.post('/api/ai/generate-media', async (request, response, next) => {
  try {
    const { title, description } = z.object({ title: z.string().trim().min(3), description: z.string().optional() }).parse(request.body)
    const media = await prisma.mediaAsset.create({ data: {
      title,
      description: description || 'Aset visual demo yang dibuat oleh provider simulasi.',
      mediaType: 'ILLUSTRATION',
      sourceType: 'AI_GENERATED',
      licenseNote: 'Ilustrasi simulasi lokal; bukan keluaran layanan AI eksternal.',
    } })
    response.status(201).json(media)
  } catch (error) { next(error) }
})

app.post('/api/questions/:id/review/accept', async (request, response, next) => {
  try {
    const question = await prisma.question.findUnique({ where: { id: request.params.id }, include: { options: true, media: { include: { mediaAsset: true } } } })
    if (!question) return response.status(404).json({ error: 'Soal tidak ditemukan.' })
    if (question.status !== 'NEEDS_REVIEW') return response.status(409).json({ error: 'Hanya soal menunggu review yang dapat diterima.' })
    if (!validateOptions(question.options)) return response.status(400).json({ error: 'Validasi opsi soal gagal.' })
    if (question.mediaNeed === 'REQUIRED' && !question.media.some(({ mediaAsset }) => mediaAsset.status === 'ACTIVE')) return response.status(400).json({ error: 'Hubungkan media aktif atau kecualikan dengan alasan sebelum menerima soal.' })
    const updated = await prisma.question.update({ where: { id: question.id }, data: { status: 'VALIDATED', validatedAt: new Date() } })
    await writeAudit('QUESTION_ACCEPTED', 'Question', updated.id)
    response.json(updated)
  } catch (error) { next(error) }
})

app.post('/api/questions/:id/review/reject', async (request, response, next) => {
  try {
    const { reason } = z.object({ reason: z.string().trim().min(3) }).parse(request.body)
    const previous = await prisma.question.findUnique({ where: { id: request.params.id } })
    if (!previous) return response.status(404).json({ error: 'Soal tidak ditemukan.' })
    if (previous.status !== 'NEEDS_REVIEW') return response.status(409).json({ error: 'Hanya soal menunggu review yang dapat ditolak.' })
    const question = await prisma.question.update({ where: { id: previous.id }, data: { status: 'REJECTED', rejectionReason: reason, validatedAt: null } })
    await writeAudit('QUESTION_REJECTED', 'Question', question.id, reason)
    response.json(question)
  } catch (error) { next(error) }
})

app.post('/api/questions/:id/detect-media', async (request, response, next) => {
  try {
    const question = await prisma.question.findUnique({ where: { id: request.params.id } })
    if (!question) return response.status(404).json({ error: 'Soal tidak ditemukan.' })
    const mediaNeed = /diagram|gambar|grafik|visual|tabel/i.test(question.questionText) ? 'REQUIRED' : 'NOT_REQUIRED'
    const updated = await prisma.question.update({ where: { id: question.id }, data: { mediaNeed, mediaExclusionNote: mediaNeed === 'NOT_REQUIRED' ? 'Pemeriksaan aturan demo: tidak memerlukan visual.' : null } })
    if (mediaNeed === 'REQUIRED') await demoteReadyPackages(question.id)
    response.json(updated)
  } catch (error) { next(error) }
})

app.post('/api/questions/:id/generate-explanations', async (request, response, next) => {
  try {
    const question = await prisma.question.findUnique({ where: { id: request.params.id }, include: { options: true } })
    if (!question) return response.status(404).json({ error: 'Soal tidak ditemukan.' })
    const updated = await prisma.$transaction(async (transaction) => {
      for (const option of question.options) {
        await transaction.answerOption.update({ where: { id: option.id }, data: {
          explanation: option.isCorrect
            ? `Pilihan ${option.label} adalah kunci jawaban. Verifikasi kembali penjelasan materi sebelum menerima soal.`
            : `Pilihan ${option.label} bukan kunci jawaban. Tinjau kembali alasan akademiknya sebelum menerima soal.`,
        } })
      }
      return transaction.question.update({
        where: { id: question.id },
        data: { status: question.status === 'VALIDATED' ? 'NEEDS_REVIEW' : question.status, validatedAt: question.status === 'VALIDATED' ? null : question.validatedAt },
        include: fullQuestion,
      })
    })
    if (question.status === 'VALIDATED') await demoteReadyPackages(question.id)
    await writeAudit('EXPLANATIONS_GENERATED', 'Question', question.id, 'Demo provider')
    response.json(updated)
  } catch (error) { next(error) }
})

app.post('/api/questions/:id/duplicate', async (request, response, next) => {
  try {
    const source = await prisma.question.findUnique({ where: { id: request.params.id }, include: { options: true } })
    if (!source) return response.status(404).json({ error: 'Soal tidak ditemukan.' })
    const copy = await prisma.question.create({ data: {
      questionText: source.questionText,
      educationLevelId: source.educationLevelId,
      grade: source.grade,
      subjectId: source.subjectId,
      topicId: source.topicId,
      difficulty: source.difficulty,
      mediaNeed: source.mediaNeed,
      mediaExclusionNote: source.mediaExclusionNote,
      status: 'NEEDS_REVIEW',
      sourceType: 'INTERNAL',
      options: { create: source.options.map((option) => ({
        label: option.label,
        text: option.text,
        isCorrect: option.isCorrect,
        explanation: option.explanation,
        sortOrder: option.sortOrder,
      })) },
    }, include: fullQuestion })
    response.status(201).json(copy)
  } catch (error) { next(error) }
})

app.post('/api/questions/:id/archive', async (request, response, next) => {
  try {
    const question = await prisma.question.update({ where: { id: request.params.id }, data: { status: 'ARCHIVED' } })
    await demoteReadyPackages(question.id)
    response.json(question)
  } catch (error) { next(error) }
})

const storage = multer.diskStorage({
  destination: (_request, _file, callback) => callback(null, uploadDirectory),
  filename: (_request, file, callback) => callback(null, `${Date.now()}-${file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_')}`),
})
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_request, file, callback) => callback(null, ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)),
})

app.get('/api/media', async (_request, response, next) => {
  try { response.json(await prisma.mediaAsset.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } })) }
  catch (error) { next(error) }
})
app.get('/api/media/candidates', async (_request, response, next) => {
  try { response.json(await prisma.mediaAsset.findMany({ where: { status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } })) }
  catch (error) { next(error) }
})
app.get('/api/media/:id', async (request, response, next) => {
  try {
    const media = await prisma.mediaAsset.findUnique({ where: { id: request.params.id } })
    if (!media) return response.status(404).json({ error: 'Media tidak ditemukan.' })
    response.json(media)
  } catch (error) { next(error) }
})
app.patch('/api/media/:id', async (request, response, next) => {
  try {
    const data = z.object({ title: z.string().trim().min(2), description: z.string().optional(), mediaType: z.enum(['IMAGE', 'DIAGRAM', 'TABLE', 'ILLUSTRATION', 'GRAPH', 'OTHER']), sourceUrl: z.string().url().optional().or(z.literal('')), licenseNote: z.string().optional() }).parse(request.body)
    response.json(await prisma.mediaAsset.update({ where: { id: request.params.id }, data }))
  } catch (error) { next(error) }
})
app.post('/api/media/:id/archive', async (request, response, next) => {
  try {
    const media = await prisma.mediaAsset.update({ where: { id: request.params.id }, data: { status: 'ARCHIVED' } })
    const relations = await prisma.questionMedia.findMany({ where: { mediaAssetId: media.id }, select: { questionId: true } })
    for (const { questionId } of relations) {
      const activeMediaCount = await prisma.questionMedia.count({ where: { questionId, mediaAsset: { status: 'ACTIVE' } } })
      if (!activeMediaCount) {
        await prisma.question.update({ where: { id: questionId }, data: { mediaNeed: 'REQUIRED' } })
        await demoteReadyPackages(questionId)
      }
    }
    response.json(media)
  }
  catch (error) { next(error) }
})
app.post('/api/media/upload', upload.single('file'), async (request, response, next) => {
  try {
    if (!request.file) return response.status(400).json({ error: 'Pilih file gambar PNG, JPG, atau WEBP maksimal 5 MB.' })
    const media = await prisma.mediaAsset.create({ data: {
      title: String(request.body.title || request.file.originalname),
      description: String(request.body.description || ''),
      filePath: `/uploads/${request.file.filename}`,
      mimeType: request.file.mimetype,
      mediaType: String(request.body.mediaType || 'IMAGE'),
      sourceType: 'UPLOADED',
      licenseNote: String(request.body.licenseNote || 'Diunggah untuk demo; pastikan hak penggunaan sebelum publikasi.'),
    } })
    response.status(201).json(media)
  } catch (error) { next(error) }
})
app.post('/api/questions/:questionId/media', async (request, response, next) => {
  try {
    const { mediaAssetId } = z.object({ mediaAssetId: z.string() }).parse(request.body)
    const relation = await prisma.questionMedia.create({ data: { questionId: request.params.questionId, mediaAssetId, isPrimary: true } })
    await prisma.question.update({ where: { id: request.params.questionId }, data: { mediaNeed: 'LINKED' } })
    response.status(201).json(relation)
  } catch (error) { next(error) }
})
app.delete('/api/questions/:questionId/media/:mediaId', async (request, response, next) => {
  try {
    await prisma.questionMedia.delete({ where: { questionId_mediaAssetId: { questionId: request.params.questionId, mediaAssetId: request.params.mediaId } } })
    const activeMediaCount = await prisma.questionMedia.count({ where: { questionId: request.params.questionId, mediaAsset: { status: 'ACTIVE' } } })
    await prisma.question.update({ where: { id: request.params.questionId }, data: { mediaNeed: activeMediaCount ? 'LINKED' : 'REQUIRED' } })
    if (!activeMediaCount) await demoteReadyPackages(request.params.questionId)
    response.status(204).end()
  } catch (error) { next(error) }
})

app.get('/api/packages', async (_request, response, next) => {
  try { response.json(await prisma.questionPackage.findMany({ include: { subject: true, educationLevel: true, questions: { include: { question: true }, orderBy: { orderIndex: 'asc' } } }, orderBy: { updatedAt: 'desc' } })) }
  catch (error) { next(error) }
})
app.get('/api/packages/:id', async (request, response, next) => {
  try {
    const item = await prisma.questionPackage.findUnique({ where: { id: request.params.id }, include: {
      subject: true,
      educationLevel: true,
      questions: { include: { question: { include: fullQuestion } }, orderBy: { orderIndex: 'asc' } },
    } })
    if (!item) return response.status(404).json({ error: 'Paket tidak ditemukan.' })
    response.json(item)
  } catch (error) { next(error) }
})
app.post('/api/packages', async (request, response, next) => {
  try {
    const data = packageInput.parse(request.body)
    if (!await prisma.packageType.findUnique({ where: { code: data.packageType } })) return response.status(400).json({ error: 'Jenis paket tidak terdaftar di data master.' })
    if (data.questionIds.length) {
      const eligible = await prisma.question.count({ where: { id: { in: data.questionIds }, status: 'VALIDATED' } })
      if (eligible !== new Set(data.questionIds).size) return response.status(400).json({ error: 'Paket hanya dapat memuat soal tervalidasi tanpa duplikasi.' })
    }
    const item = await prisma.questionPackage.create({ data: {
      title: data.title,
      description: data.description,
      packageType: data.packageType,
      educationLevelId: data.educationLevelId,
      grade: data.grade,
      subjectId: data.subjectId,
      questions: { create: data.questionIds.map((questionId, orderIndex) => ({ questionId, orderIndex })) },
    }, include: { questions: true } })
    response.status(201).json(item)
  } catch (error) { next(error) }
})
app.post('/api/packages/:id/questions', async (request, response, next) => {
  try {
    const { questionId } = z.object({ questionId: z.string() }).parse(request.body)
    const question = await prisma.question.findUnique({ where: { id: questionId } })
    if (!question || question.status !== 'VALIDATED') return response.status(400).json({ error: 'Hanya soal tervalidasi dapat ditambahkan.' })
    const last = await prisma.packageQuestion.findFirst({ where: { packageId: request.params.id }, orderBy: { orderIndex: 'desc' } })
    const item = await prisma.packageQuestion.create({ data: { packageId: request.params.id, questionId, orderIndex: (last?.orderIndex ?? -1) + 1 } })
    await prisma.questionPackage.update({ where: { id: request.params.id }, data: { status: 'DRAFT' } })
    response.status(201).json(item)
  } catch (error) { next(error) }
})
app.delete('/api/packages/:id/questions/:questionId', async (request, response, next) => {
  try {
    await prisma.packageQuestion.delete({ where: { packageId_questionId: { packageId: request.params.id, questionId: request.params.questionId } } })
    const remaining = await prisma.packageQuestion.findMany({ where: { packageId: request.params.id }, orderBy: { orderIndex: 'asc' } })
    await prisma.$transaction(remaining.map((item, orderIndex) => prisma.packageQuestion.update({ where: { id: item.id }, data: { orderIndex } })))
    await prisma.questionPackage.update({ where: { id: request.params.id }, data: { status: 'DRAFT' } })
    response.status(204).end()
  } catch (error) { next(error) }
})
app.patch('/api/packages/:id', async (request, response, next) => {
  try {
    const data = z.object({
      title: z.string().trim().min(3),
      description: z.string().optional(),
      packageType: z.string().min(2),
      educationLevelId: z.string(),
      grade: z.string().min(1),
      subjectId: z.string(),
      questionIds: z.array(z.string()).optional(),
    }).parse(request.body)
    if (!await prisma.packageType.findUnique({ where: { code: data.packageType } })) return response.status(400).json({ error: 'Jenis paket tidak terdaftar di data master.' })
    if (data.questionIds) {
      const eligible = await prisma.question.count({ where: { id: { in: data.questionIds }, status: 'VALIDATED' } })
      if (eligible !== new Set(data.questionIds).size) return response.status(400).json({ error: 'Paket hanya dapat memuat soal tervalidasi tanpa duplikasi.' })
      await prisma.packageQuestion.deleteMany({ where: { packageId: request.params.id } })
    }
    const item = await prisma.questionPackage.update({ where: { id: request.params.id }, data: {
      title: data.title,
      description: data.description,
      packageType: data.packageType,
      educationLevelId: data.educationLevelId,
      grade: data.grade,
      subjectId: data.subjectId,
      status: 'DRAFT',
      ...(data.questionIds ? { questions: { create: data.questionIds.map((questionId, orderIndex) => ({ questionId, orderIndex })) } } : {}),
    }, include: { questions: { include: { question: true }, orderBy: { orderIndex: 'asc' } } } })
    response.json(item)
  } catch (error) { next(error) }
})
app.post('/api/packages/:id/ready', async (request, response, next) => {
  try {
    const item = await prisma.questionPackage.findUnique({
      where: { id: request.params.id },
      include: {
        questions: {
          include: { question: { include: { media: { include: { mediaAsset: true } } } } },
        },
      },
    })
    if (!item) return response.status(404).json({ error: 'Paket tidak ditemukan.' })
    const issue = packageReadinessIssue(item.questions.map(({ question }) => ({
      status: question.status,
      mediaNeed: question.mediaNeed,
      mediaCount: question.media.filter(({ mediaAsset }) => mediaAsset.status === 'ACTIVE').length,
    })))
    if (issue) return response.status(400).json({ error: issue })
    response.json(await prisma.questionPackage.update({ where: { id: item.id }, data: { status: 'READY' } }))
  } catch (error) { next(error) }
})
app.post('/api/packages/:id/archive', async (request, response, next) => {
  try { response.json(await prisma.questionPackage.update({ where: { id: request.params.id }, data: { status: 'ARCHIVED' } })) }
  catch (error) { next(error) }
})
app.get('/api/packages/:id/export', async (request, response, next) => {
  try {
    const item = await prisma.questionPackage.findUnique({ where: { id: request.params.id }, include: { questions: { include: { question: { include: { options: true } } }, orderBy: { orderIndex: 'asc' } } } })
    if (!item) return response.status(404).json({ error: 'Paket tidak ditemukan.' })
    const data = item.questions.map(({ question }, index) => ({ nomor: index + 1, pertanyaan: question.questionText, opsi: question.options.map(({ label, text }) => `${label}. ${text}`).join(' | ') }))
    if (request.query.format === 'csv') {
      response.type('text/csv').send(['nomor,pertanyaan,opsi', ...data.map((row) => `${row.nomor},"${row.pertanyaan.replace(/"/g, '""')}","${row.opsi.replace(/"/g, '""')}"`)].join('\n'))
      return
    }
    response.json({ title: item.title, questions: data })
  } catch (error) { next(error) }
})

app.get('/api/quiz/packages', async (_request, response, next) => {
  try { response.json(await prisma.questionPackage.findMany({ where: { status: 'READY' }, include: { subject: true, questions: true } })) }
  catch (error) { next(error) }
})
app.post('/api/quiz/attempts', async (request, response, next) => {
  try {
    const { packageId, studentDisplayName } = z.object({ packageId: z.string(), studentDisplayName: z.string().trim().min(2).max(50) }).parse(request.body)
    const item = await prisma.questionPackage.findUnique({ where: { id: packageId }, include: { questions: true } })
    if (!item || item.status !== 'READY' || !item.questions.length) return response.status(400).json({ error: 'Paket belum siap dikerjakan.' })
    const attempt = await prisma.quizAttempt.create({ data: { packageId, studentDisplayName, totalQuestions: item.questions.length } })
    response.status(201).json(attempt)
  } catch (error) { next(error) }
})
app.get('/api/quiz/attempts/:id/questions', async (request, response, next) => {
  try {
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: request.params.id },
      include: {
        package: {
          include: {
            questions: {
              include: {
                question: {
                  include: {
                    options: { orderBy: { sortOrder: 'asc' } },
                    media: { include: { mediaAsset: true } },
                  },
                },
              },
              orderBy: { orderIndex: 'asc' },
            },
          },
        },
      },
    })
    if (!attempt) return response.status(404).json({ error: 'Attempt tidak ditemukan.' })
    response.json(attempt.package.questions.map(({ question }) => ({
      ...toPublicQuizQuestion(question),
      media: question.media.map(({ mediaAsset }) => mediaAsset),
    })))
  } catch (error) { next(error) }
})
app.post('/api/quiz/attempts/:id/submit', async (request, response, next) => {
  try {
    const { answers } = z.object({ answers: z.array(z.object({ questionId: z.string(), selectedOptionId: z.string().nullable() })) }).parse(request.body)
    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: request.params.id },
      include: {
        package: {
          include: {
            questions: { include: { question: { include: { options: true } } } },
          },
        },
      },
    })
    if (!attempt) return response.status(404).json({ error: 'Attempt tidak ditemukan.' })
    if (attempt.submittedAt) return response.status(409).json({ error: 'Kuis ini sudah dikirim.' })
    const expected = attempt.package.questions.map(({ question }) => question)
    const answerMap = new Map(answers.map((answer) => [answer.questionId, answer.selectedOptionId]))
    if (answers.length !== expected.length || expected.some((question) => !answerMap.has(question.id))) return response.status(400).json({ error: 'Jawaban untuk setiap soal wajib dikirim tepat satu kali.' })
    const details = expected.map((question) => {
      const selectedOptionId = answerMap.get(question.id) || null
      const selected = question.options.find((option) => option.id === selectedOptionId)
      const correct = question.options.find((option) => option.isCorrect)
      return { questionId: question.id, selectedOptionId, isCorrect: Boolean(selected?.isCorrect), correctOptionId: correct?.id }
    })
    const correctCount = details.filter((answer) => answer.isCorrect).length
    await prisma.$transaction([
      ...details.map((answer) => prisma.studentAnswer.create({ data: {
        attemptId: attempt.id,
        questionId: answer.questionId,
        selectedOptionId: answer.selectedOptionId,
        isCorrect: answer.isCorrect,
      } })),
      prisma.quizAttempt.update({ where: { id: attempt.id }, data: {
        score: calculateScore(correctCount, expected.length),
        correctCount,
        wrongCount: expected.length - correctCount,
        submittedAt: new Date(),
      } }),
    ])
    await writeAudit('QUIZ_SUBMITTED', 'QuizAttempt', attempt.id)
    response.json({ score: calculateScore(correctCount, expected.length), correctCount, wrongCount: expected.length - correctCount, answers: details })
  } catch (error) { next(error) }
})

app.get('/api/results', async (_request, response, next) => {
  try { response.json(await prisma.quizAttempt.findMany({ where: { submittedAt: { not: null } }, include: { package: true }, orderBy: { submittedAt: 'desc' } })) }
  catch (error) { next(error) }
})
app.get('/api/results/:attemptId', async (request, response, next) => {
  try {
    const result = await prisma.quizAttempt.findUnique({
      where: { id: request.params.attemptId },
      include: {
        package: true,
        answers: {
          include: { question: { include: { options: { orderBy: { sortOrder: 'asc' } } } } },
        },
      },
    })
    if (!result || !result.submittedAt) return response.status(404).json({ error: 'Hasil belum tersedia.' })
    response.json(result)
  } catch (error) { next(error) }
})
app.get('/api/distributions', async (_request, response, next) => {
  try { response.json(await prisma.resultDistribution.findMany({ include: { attempt: { include: { package: true } } }, orderBy: { createdAt: 'desc' } })) }
  catch (error) { next(error) }
})
app.post('/api/results/:attemptId/distributions', async (request, response, next) => {
  try {
    const data = z.object({ recipientType: z.enum(['STUDENT', 'PARENT']), channel: z.enum(['EMAIL', 'WHATSAPP']), recipientLabel: z.string().trim().min(2) }).parse(request.body)
    const attempt = await prisma.quizAttempt.findUnique({ where: { id: request.params.attemptId }, include: { package: true } })
    if (!attempt?.submittedAt) return response.status(404).json({ error: 'Hasil kuis tidak ditemukan.' })
    const result = await prisma.resultDistribution.create({ data: {
      ...data,
      attemptId: attempt.id,
      messagePreview: `Hasil ${attempt.package.title}: ${attempt.studentDisplayName} memperoleh skor ${attempt.score}/100. Ini hanya preview simulasi.`,
    } })
    response.status(201).json(result)
  } catch (error) { next(error) }
})

app.get('/api/payments', async (_request, response, next) => {
  try { response.json(await prisma.paymentTransaction.findMany({ orderBy: { createdAt: 'desc' } })) }
  catch (error) { next(error) }
})
app.get('/api/payments/:id', async (request, response, next) => {
  try {
    const item = await prisma.paymentTransaction.findUnique({ where: { id: request.params.id } })
    if (!item) return response.status(404).json({ error: 'Transaksi tidak ditemukan.' })
    response.json(item)
  } catch (error) { next(error) }
})
app.post('/api/payments', async (request, response, next) => {
  try {
    const { serviceName, amount } = z.object({ serviceName: z.string().trim().min(2), amount: z.number().int().min(0).max(100000000) }).parse(request.body)
    const record = await prisma.paymentTransaction.create({ data: { serviceName, amount, referenceCode: `DEMO-${Date.now()}-${Math.floor(Math.random() * 1000)}` } })
    response.status(201).json(record)
  } catch (error) { next(error) }
})
app.post('/api/payments/:id/simulate-:status', async (request, response, next) => {
  try {
    const status = ({ success: 'PAID', failure: 'FAILED', pending: 'PENDING' } as Record<string, string>)[request.params.status]
    if (!status) return response.status(400).json({ error: 'Status simulasi tidak valid.' })
    const result = await prisma.paymentTransaction.update({ where: { id: request.params.id }, data: { status } })
    await writeAudit('PAYMENT_SIMULATED', 'PaymentTransaction', result.id, status)
    response.json(result)
  } catch (error) { next(error) }
})

app.post('/api/demo/reset', async (_request, response, next) => {
  try {
    await seedDemo(prisma)
    response.json({ reset: true })
  } catch (error) { next(error) }
})

app.use((error: unknown, _request: express.Request, response: express.Response, next: express.NextFunction) => {
  void next
  if (error instanceof z.ZodError) return response.status(400).json({ error: error.issues.map((issue) => issue.message).join(' ') })
  const message = error instanceof Error ? error.message : 'Terjadi kesalahan server.'
  const code = typeof error === 'object' && error && 'code' in error ? String(error.code) : ''
  const status = code === 'P2002' || code === 'P2003' ? 409 : code === 'P2025' ? 404 : message.includes('Unique constraint') ? 409 : message.includes('Record to update not found') ? 404 : 500
  response.status(status).json({ error: status === 500 ? 'Terjadi kesalahan server.' : message })
})

if (process.env.NODE_ENV !== 'test') {
  app.listen(port, () => console.log(`Antiremed API listening on http://localhost:${port}`))
}