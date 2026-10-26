import { PrismaClient } from '@prisma/client'
import { pathToFileURL } from 'node:url'
import path from 'node:path'

const defaultClient = new PrismaClient()

const seedQuestions = [
  { subject: 'Matematika', topic: 'Pecahan', level: 'SD', grade: '5', text: 'Hasil dari 3/4 + 1/4 adalah ...', options: ['1', '1/2', '3/8', '4/8'], correct: 0, status: 'VALIDATED', mediaNeed: 'NOT_REQUIRED' },
  { subject: 'Fisika', topic: 'Gerak Lurus', level: 'SMA', grade: '10', text: 'Sebuah benda menempuh 100 meter dalam 20 detik. Kelajuan rata-ratanya adalah ...', options: ['5 m/s', '20 m/s', '80 m/s', '120 m/s'], correct: 0, status: 'VALIDATED', mediaNeed: 'NOT_REQUIRED' },
  { subject: 'Biologi', topic: 'Sistem Pencernaan', level: 'SMP', grade: '8', text: 'Organ yang menyerap sebagian besar sari makanan adalah ...', options: ['Kerongkongan', 'Usus halus', 'Lambung', 'Usus besar'], correct: 1, status: 'VALIDATED', mediaNeed: 'REQUIRED' },
  { subject: 'Matematika', topic: 'Bangun Datar', level: 'SMP', grade: '7', text: 'Perhatikan diagram segitiga dengan alas 10 cm dan tinggi 6 cm. Luas segitiga tersebut adalah ...', options: ['16 cm2', '30 cm2', '60 cm2', '32 cm2'], correct: 1, status: 'NEEDS_REVIEW', mediaNeed: 'REQUIRED' },
  { subject: 'Kimia', topic: 'Struktur Atom', level: 'SMA', grade: '10', text: 'Partikel atom yang bermuatan negatif adalah ...', options: ['Proton', 'Neutron', 'Elektron', 'Nukleon'], correct: 2, status: 'NEEDS_REVIEW', mediaNeed: 'NOT_REQUIRED' },
  { subject: 'Bahasa Indonesia', topic: 'Teks Eksposisi', level: 'SMA', grade: '11', text: 'Bagian teks eksposisi yang berisi pendapat awal penulis disebut ...', options: ['Tesis', 'Argumentasi', 'Penegasan ulang', 'Orientasi'], correct: 0, status: 'DRAFT', mediaNeed: 'NOT_REQUIRED' },
  { subject: 'Fisika', topic: 'Gaya dan Gerak', level: 'SMP', grade: '8', text: 'Gaya sebesar 12 N bekerja pada benda bermassa 3 kg. Percepatan benda adalah ...', options: ['4 m/s2', '9 m/s2', '15 m/s2', '36 m/s2'], correct: 0, status: 'REJECTED', mediaNeed: 'NOT_REQUIRED', rejectionReason: 'Satuan dan konteks perlu ditulis lebih jelas.' },
  { subject: 'Kimia', topic: 'Larutan', level: 'SMA', grade: '11', text: 'Larutan dengan pH 3 bersifat ...', options: ['Asam', 'Netral', 'Basa', 'Garam'], correct: 0, status: 'VALIDATED', mediaNeed: 'NOT_REQUIRED' },
  { subject: 'Biologi', topic: 'Ekosistem', level: 'SMP', grade: '7', text: 'Dalam rantai makanan, tumbuhan hijau berperan sebagai ...', options: ['Konsumen primer', 'Produsen', 'Dekomposer', 'Predator'], correct: 1, status: 'NEEDS_REVIEW', mediaNeed: 'REQUIRED' },
  { subject: 'Bahasa Indonesia', topic: 'Teks Narasi', level: 'SMP', grade: '8', text: 'Unsur yang menunjukkan tempat, waktu, dan suasana cerita disebut ...', options: ['Alur', 'Latar', 'Tema', 'Amanat'], correct: 1, status: 'NEEDS_REVIEW', mediaNeed: 'NOT_REQUIRED' },
  { subject: 'Matematika', topic: 'Persamaan Linear', level: 'SMP', grade: '8', text: 'Jika 2x + 6 = 14, nilai x adalah ...', options: ['2', '3', '4', '5'], correct: 2, status: 'DRAFT', mediaNeed: 'NOT_REQUIRED' },
  { subject: 'Fisika', topic: 'Gelombang', level: 'SMA', grade: '11', text: 'Grafik menunjukkan satu gelombang penuh sepanjang 4 meter. Panjang gelombangnya adalah ...', options: ['1 m', '2 m', '4 m', '8 m'], correct: 2, status: 'VALIDATED', mediaNeed: 'REQUIRED' },
  { subject: 'Matematika', topic: 'Pecahan', level: 'SD', grade: '5', text: 'Ibu memotong kue menjadi 8 bagian sama besar. Jika 3 bagian dimakan, bagian kue yang tersisa adalah ...', options: ['3/8', '5/8', '5/3', '8/5'], correct: 1, status: 'VALIDATED', mediaNeed: 'NOT_REQUIRED' },
  { subject: 'Matematika', topic: 'Pecahan', level: 'SD', grade: '5', text: 'Pecahan yang senilai dengan 2/3 adalah ...', options: ['3/4', '4/6', '5/6', '2/6'], correct: 1, status: 'VALIDATED', mediaNeed: 'NOT_REQUIRED' },
]

export async function seedDemo(client: PrismaClient = defaultClient) {
  await client.studentAnswer.deleteMany()
  await client.resultDistribution.deleteMany()
  await client.quizAttempt.deleteMany()
  await client.packageQuestion.deleteMany()
  await client.questionMedia.deleteMany()
  await client.answerOption.deleteMany()
  await client.question.deleteMany()
  await client.questionPackage.deleteMany()
  await client.mediaAsset.deleteMany()
  await client.paymentTransaction.deleteMany()
  await client.auditLog.deleteMany()
  await client.packageType.deleteMany()
  await client.topic.deleteMany()
  await client.subject.deleteMany()
  await client.educationLevel.deleteMany()
  await client.user.deleteMany()

  const levels = await Promise.all(['SD', 'SMP', 'SMA', 'UTBK/SNBT'].map((name) => client.educationLevel.create({ data: { name } })))
  const subjects = await Promise.all(['Matematika', 'Fisika', 'Kimia', 'Biologi', 'Bahasa Indonesia'].map((name) => client.subject.create({ data: { name } })))
  await client.packageType.createMany({ data: [
    { code: 'PRACTICE', name: 'Latihan' },
    { code: 'DAILY_TEST', name: 'Tes Harian' },
    { code: 'MIDTERM', name: 'UTS' },
    { code: 'FINAL', name: 'UAS' },
    { code: 'TKA', name: 'TKA' },
    { code: 'SNBT', name: 'SNBT' },
  ] })
  const topicByKey = new Map<string, string>()
  for (const subject of subjects) {
    const topics = subject.name === 'Matematika' ? ['Pecahan', 'Bangun Datar', 'Persamaan Linear']
      : subject.name === 'Fisika' ? ['Gerak Lurus', 'Gaya dan Gerak', 'Gelombang']
        : subject.name === 'Kimia' ? ['Struktur Atom', 'Larutan']
          : subject.name === 'Biologi' ? ['Sistem Pencernaan', 'Ekosistem']
            : ['Teks Eksposisi', 'Teks Narasi']
    for (const name of topics) {
      const topic = await client.topic.create({ data: { name, subjectId: subject.id } })
      topicByKey.set(`${subject.name}:${name}`, topic.id)
    }
  }

  const teacher = await client.user.create({ data: { name: 'Rani Pratama', role: 'TEACHER' } })
  const admin = await client.user.create({ data: { name: 'Admin Demo', role: 'ADMIN' } })
  const mediaRecords = await Promise.all([
    ['Diagram pencernaan manusia', 'DIAGRAM'],
    ['Segitiga dan tinggi', 'DIAGRAM'],
    ['Ilustrasi rantai makanan', 'ILLUSTRATION'],
    ['Grafik gelombang', 'GRAPH'],
    ['Tabel periodik sederhana', 'TABLE'],
    ['Ilustrasi pecahan', 'ILLUSTRATION'],
  ].map(([title, mediaType]) => client.mediaAsset.create({ data: {
    title,
    mediaType,
    sourceType: 'INTERNAL',
    description: 'Kandidat demo lokal; berkas visual dapat ditambahkan melalui workspace media.',
    licenseNote: 'Aset katalog prototype untuk demonstrasi akademik.',
  } })))

  const questions = []
  for (let index = 0; index < seedQuestions.length; index += 1) {
    const item = seedQuestions[index]
    const subject = subjects.find(({ name }) => name === item.subject)!
    const level = levels.find(({ name }) => name === item.level)!
    const question = await client.question.create({
      data: {
        questionText: item.text,
        educationLevelId: level.id,
        grade: item.grade,
        subjectId: subject.id,
        topicId: topicByKey.get(`${item.subject}:${item.topic}`)!,
        difficulty: index % 3 === 0 ? 'EASY' : index % 3 === 1 ? 'MEDIUM' : 'HARD',
        status: item.status,
        mediaNeed: item.mediaNeed,
        rejectionReason: 'rejectionReason' in item ? item.rejectionReason : null,
        mediaExclusionNote: item.mediaNeed === 'NOT_REQUIRED' ? 'Tidak membutuhkan visual untuk memahami soal.' : null,
        sourceType: index % 2 ? 'INTERNAL' : 'AI_GENERATED',
        createdById: teacher.id,
        validatedAt: item.status === 'VALIDATED' ? new Date(Date.now() - index * 3600000) : null,
        options: { create: item.options.map((text, optionIndex) => ({
          label: String.fromCharCode(65 + optionIndex),
          text,
          isCorrect: optionIndex === item.correct,
          explanation: optionIndex === item.correct ? 'Jawaban ini sesuai dengan konsep yang diuji.' : 'Pilihan ini belum sesuai dengan konsep yang diuji.',
          sortOrder: optionIndex,
        })) },
      },
    })
    questions.push(question)
  }

  for (const [questionIndex, mediaIndex] of [[2, 0], [3, 1], [8, 2], [11, 3]]) {
    await client.questionMedia.create({ data: { questionId: questions[questionIndex].id, mediaAssetId: mediaRecords[mediaIndex].id, isPrimary: true } })
  }
  await client.question.update({ where: { id: questions[2].id }, data: { mediaNeed: 'LINKED' } })
  await client.question.update({ where: { id: questions[11].id }, data: { mediaNeed: 'LINKED' } })

  const readyPackage = await client.questionPackage.create({ data: {
    title: 'Latihan Konsep Dasar',
    description: 'Paket demo dengan tiga soal tervalidasi.',
    packageType: 'PRACTICE',
    status: 'READY',
    educationLevelId: levels.find(({ name }) => name === 'SD')!.id,
    grade: '5',
    subjectId: subjects.find(({ name }) => name === 'Matematika')!.id,
  } })
  const packageQuestionIds = [questions[0].id, questions[12].id, questions[13].id]
  await Promise.all(packageQuestionIds.map((questionId, orderIndex) => client.packageQuestion.create({ data: { packageId: readyPackage.id, questionId, orderIndex } })))
  const draftPackage = await client.questionPackage.create({ data: {
    title: 'Persiapan Evaluasi Semester',
    description: 'Paket yang masih disusun.',
    packageType: 'MIDTERM',
    status: 'DRAFT',
    educationLevelId: levels.find(({ name }) => name === 'SMA')!.id,
    grade: '10',
    subjectId: subjects.find(({ name }) => name === 'Fisika')!.id,
  } })
  await client.packageQuestion.create({ data: { packageId: draftPackage.id, questionId: questions[0].id, orderIndex: 0 } })
  await client.questionPackage.create({ data: {
    title: 'Arsip Tes Harian',
    packageType: 'DAILY_TEST',
    status: 'ARCHIVED',
    educationLevelId: levels[0].id,
    grade: '5',
    subjectId: subjects[0].id,
  } })

  for (const [name, score] of [['Dimas Demo', 67], ['Alya Demo', 100]] as const) {
    const attempt = await client.quizAttempt.create({ data: {
      packageId: readyPackage.id,
      studentDisplayName: name,
      totalQuestions: packageQuestionIds.length,
      correctCount: score === 100 ? 3 : 2,
      wrongCount: score === 100 ? 0 : 1,
      score,
      submittedAt: new Date(Date.now() - (name.startsWith('Dimas') ? 86400000 : 3600000)),
    } })
    const details = await client.question.findMany({ where: { id: { in: packageQuestionIds } }, include: { options: true } })
    await Promise.all(packageQuestionIds.map((questionId, index) => {
      const question = details.find(({ id }) => id === questionId)!
      const correct = question.options.find(({ isCorrect }) => isCorrect)!
      const wrong = question.options.find(({ isCorrect }) => !isCorrect)!
      const isCorrect = score === 100 || index < 2
      return client.studentAnswer.create({ data: { attemptId: attempt.id, questionId, selectedOptionId: isCorrect ? correct.id : wrong.id, isCorrect } })
    }))
    if (name.startsWith('Alya')) await client.resultDistribution.create({ data: {
      attemptId: attempt.id,
      recipientType: 'PARENT',
      channel: 'WHATSAPP',
      recipientLabel: 'Orang tua Alya (demo)',
      messagePreview: `Hasil ${readyPackage.title}: Alya Demo memperoleh skor ${score}/100. Ini hanya preview simulasi.`,
    } })
  }

  await client.paymentTransaction.create({ data: { serviceName: 'Paket Belajar Demo', amount: 150000, referenceCode: 'DEMO-ANTIREMED-001' } })
  await client.auditLog.createMany({ data: [
    { actorRole: 'ADMIN', action: 'DEMO_SEEDED', entityType: 'System', entityId: admin.id, details: 'Data demo awal dibuat.' },
    { actorRole: 'TEACHER', action: 'QUESTION_ACCEPTED', entityType: 'Question', entityId: questions[0].id },
    { actorRole: 'TEACHER', action: 'PACKAGE_CREATED', entityType: 'QuestionPackage', entityId: readyPackage.id },
  ] })
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  seedDemo().finally(() => defaultClient.$disconnect())
}
