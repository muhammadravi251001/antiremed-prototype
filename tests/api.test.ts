import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { app, prisma } from '../api/server'
import { seedDemo } from '../prisma/seed'

describe('REST API demo workflows', () => {
  let generatedId = ''
  let acceptedId = ''
  let attemptId = ''

  beforeAll(async () => {
    await seedDemo(prisma)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('exposes local health and demo provider status', async () => {
    await request(app).get('/api/health').expect(200).expect(({ body }) => {
      expect(body.storage).toBe('sqlite-local')
    })
    await request(app).get('/api/demo/status').expect(200).expect(({ body }) => {
      expect(body.demoMode).toBe(true)
    })
  })

  it('manages package-type master data and validates packages against it', async () => {
    const createdType = await request(app).post('/api/master/package-types').send({ name: 'Praktikum API' }).expect(201)
    expect(createdType.body.code).toBe('PRAKTIKUM_API')
    await request(app).post('/api/master/package-types').send({ name: 'Praktikum API' }).expect(409)
    await request(app).patch(`/api/master/package-types/${createdType.body.id}`).send({ name: 'Praktikum Demo' }).expect(200)
    const [level, subject] = await Promise.all([prisma.educationLevel.findFirst(), prisma.subject.findFirst()])
    await request(app).post('/api/packages').send({
      title: 'Paket tipe custom',
      packageType: createdType.body.code,
      educationLevelId: level!.id,
      grade: '8',
      subjectId: subject!.id,
      questionIds: [],
    }).expect(201)
    await request(app).delete(`/api/master/package-types/${createdType.body.id}`).expect(204)
    await request(app).post('/api/packages').send({
      title: 'Paket tipe terhapus',
      packageType: createdType.body.code,
      educationLevelId: level!.id,
      grade: '8',
      subjectId: subject!.id,
      questionIds: [],
    }).expect(400)
  })

  it('generates and stores questions that remain in the review queue', async () => {
    const [level, subject] = await Promise.all([prisma.educationLevel.findFirst(), prisma.subject.findFirst({ where: { name: 'Matematika' } })])
    const topic = await prisma.topic.findFirst({ where: { subjectId: subject!.id } })
    const response = await request(app).post('/api/ai/generate-questions').send({
      educationLevelId: level!.id,
      grade: '8',
      subjectId: subject!.id,
      topicId: topic!.id,
      count: 1,
      difficulty: 'MEDIUM',
      optionCount: 4,
      media: 'NO',
    }).expect(201)
    generatedId = response.body.questions[0].id
    expect(response.body.mode).toBe('DEMO')
    expect(response.body.questions[0].status).toBe('NEEDS_REVIEW')
    expect(response.body.questions[0].options.filter((option: { isCorrect: boolean }) => option.isCorrect)).toHaveLength(1)
  })

  it('requires a rejection reason and stores the rejected state', async () => {
    await request(app).post(`/api/questions/${generatedId}/review/reject`).send({}).expect(400)
    const response = await request(app).post(`/api/questions/${generatedId}/review/reject`).send({ reason: 'Perlu verifikasi materi.' }).expect(200)
    expect(response.body.status).toBe('REJECTED')
    expect(response.body.rejectionReason).toBe('Perlu verifikasi materi.')
  })

  it('accepts a valid question, then returns it to review after editing', async () => {
    const [level, subject] = await Promise.all([prisma.educationLevel.findFirst(), prisma.subject.findFirst({ where: { name: 'Matematika' } })])
    const topic = await prisma.topic.findFirst({ where: { subjectId: subject!.id } })
    const generated = await request(app).post('/api/ai/generate-questions').send({
      educationLevelId: level!.id,
      grade: '8',
      subjectId: subject!.id,
      topicId: topic!.id,
      count: 1,
      difficulty: 'EASY',
      optionCount: 4,
      media: 'NO',
    }).expect(201)
    acceptedId = generated.body.questions[0].id
    await request(app).post(`/api/questions/${acceptedId}/review/accept`).send({}).expect(200)
    const current = await request(app).get(`/api/questions/${acceptedId}`).expect(200)
    const [packageLevel, packageSubject] = await Promise.all([prisma.educationLevel.findFirst(), prisma.subject.findFirst()])
    const packageResponse = await request(app).post('/api/packages').send({
      title: 'Paket sejarah jawaban',
      educationLevelId: packageLevel!.id,
      grade: '8',
      subjectId: packageSubject!.id,
      questionIds: [acceptedId],
    }).expect(201)
    await request(app).post(`/api/packages/${packageResponse.body.id}/ready`).send({}).expect(200)
    const attempt = await request(app).post('/api/quiz/attempts').send({ packageId: packageResponse.body.id, studentDisplayName: 'Riwayat Demo' }).expect(201)
    const selectedOptionId = current.body.options[0].id
    await prisma.studentAnswer.create({ data: {
      attemptId: attempt.body.id,
      questionId: acceptedId,
      selectedOptionId,
      isCorrect: false,
    } })
    const edit = await request(app).patch(`/api/questions/${acceptedId}`).send({
      questionText: `${current.body.questionText} (revisi)`,
      educationLevelId: current.body.educationLevelId,
      grade: current.body.grade,
      subjectId: current.body.subjectId,
      topicId: current.body.topicId,
      difficulty: current.body.difficulty,
      mediaNeed: 'NOT_REQUIRED',
      mediaExclusionNote: 'Tidak membutuhkan visual.',
      options: current.body.options.map(({ label, text, isCorrect, explanation }: { label: string; text: string; isCorrect: boolean; explanation: string }) => ({ label, text, isCorrect, explanation })),
    }).expect(200)
    expect(edit.body.status).toBe('NEEDS_REVIEW')
    expect(edit.body.options.map((option: { id: string }) => option.id)).toContain(selectedOptionId)
    const savedAnswer = await prisma.studentAnswer.findUnique({ where: { attemptId_questionId: { attemptId: attempt.body.id, questionId: acceptedId } }, include: { selectedOption: true } })
    expect(savedAnswer?.selectedOption?.id).toBe(selectedOptionId)
    const updatedPackage = await prisma.questionPackage.findUnique({ where: { id: packageResponse.body.id } })
    expect(updatedPackage?.status).toBe('DRAFT')
  })

  it('blocks packages without validated questions', async () => {
    const [level, subject] = await Promise.all([prisma.educationLevel.findFirst(), prisma.subject.findFirst()])
    const response = await request(app).post('/api/packages').send({
      title: 'Paket test readiness',
      educationLevelId: level!.id,
      grade: '8',
      subjectId: subject!.id,
      questionIds: [acceptedId],
    }).expect(400)
    expect(response.body.error).toMatch(/tervalidasi/)
  })

  it('withholds answer keys before submission and calculates results on the server', async () => {
    const readyPackage = await prisma.questionPackage.findFirst({ where: { status: 'READY' } })
    const started = await request(app).post('/api/quiz/attempts').send({ packageId: readyPackage!.id, studentDisplayName: 'Siswa Integration' }).expect(201)
    attemptId = started.body.id
    const questionResponse = await request(app).get(`/api/quiz/attempts/${attemptId}/questions`).expect(200)
    expect(questionResponse.body.length).toBeGreaterThan(0)
    expect(questionResponse.body[0].options[0]).not.toHaveProperty('isCorrect')
    expect(questionResponse.body[0].options[0]).not.toHaveProperty('explanation')
    const submitted = await request(app).post(`/api/quiz/attempts/${attemptId}/submit`).send({
      answers: questionResponse.body.map((question: { id: string; options: { id: string }[] }) => ({ questionId: question.id, selectedOptionId: question.options[0].id })),
    }).expect(200)
    expect(submitted.body.score).toBeGreaterThanOrEqual(0)
    expect(submitted.body.score).toBeLessThanOrEqual(100)
    expect(submitted.body.correctCount + submitted.body.wrongCount).toBe(questionResponse.body.length)
    await request(app).post(`/api/quiz/attempts/${attemptId}/submit`).send({ answers: [] }).expect(409)
  })

  it('persists result distribution and payment simulation states', async () => {
    const distribution = await request(app).post(`/api/results/${attemptId}/distributions`).send({
      recipientType: 'STUDENT',
      channel: 'EMAIL',
      recipientLabel: 'Siswa demo',
    }).expect(201)
    expect(distribution.body.status).toBe('SIMULATED')

    const payment = await request(app).post('/api/payments').send({ serviceName: 'Paket demo API test', amount: 50000 }).expect(201)
    expect(payment.body.status).toBe('PENDING')
    const updated = await request(app).post(`/api/payments/${payment.body.id}/simulate-success`).send({}).expect(200)
    expect(updated.body.status).toBe('PAID')
  })

  it('demotes a ready package when its required media is archived', async () => {
    const [readyPackage, question] = await Promise.all([
      prisma.questionPackage.findFirst({ where: { status: 'READY' } }),
      prisma.question.findFirst({ where: { status: 'VALIDATED', mediaNeed: 'LINKED' }, include: { media: true } }),
    ])
    const mediaAssetId = question!.media[0].mediaAssetId
    await request(app).post(`/api/packages/${readyPackage!.id}/questions`).send({ questionId: question!.id }).expect(201)
    await request(app).post(`/api/packages/${readyPackage!.id}/ready`).send({}).expect(200)
    await request(app).post(`/api/media/${mediaAssetId}/archive`).send({}).expect(200)
    const [packageAfterArchive, questionAfterArchive] = await Promise.all([
      prisma.questionPackage.findUnique({ where: { id: readyPackage!.id } }),
      prisma.question.findUnique({ where: { id: question!.id } }),
    ])
    expect(packageAfterArchive?.status).toBe('DRAFT')
    expect(questionAfterArchive?.mediaNeed).toBe('REQUIRED')
  })

  it('rejects unsupported uploads', async () => {
    await request(app).post('/api/media/upload')
      .attach('file', Buffer.from('not an image'), { filename: 'notes.txt', contentType: 'text/plain' })
      .expect(400)
  })
})