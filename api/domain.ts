export type GeneratedQuestionInput = {
  educationLevel: string
  grade: string
  subject: string
  topic: string
  difficulty: 'EASY' | 'MEDIUM' | 'HARD'
  optionCount: 4 | 5
  additionalInstruction?: string
}

export type GeneratedOption = {
  label: string
  text: string
  isCorrect: boolean
  explanation: string
  sortOrder: number
}

export function generateDemoQuestion(input: GeneratedQuestionInput, index: number) {
  const answer = 1 + (index % input.optionCount)
  const labels = ['A', 'B', 'C', 'D', 'E'].slice(0, input.optionCount)
  const correctText = `Konsep ${input.topic} yang tepat adalah pilihan ${labels[answer - 1]}.`
  const options: GeneratedOption[] = labels.map((label, optionIndex) => ({
    label,
    text: optionIndex + 1 === answer ? correctText : `Pernyataan ${label} tentang ${input.topic} perlu ditinjau kembali.`,
    isCorrect: optionIndex + 1 === answer,
    explanation: optionIndex + 1 === answer
      ? `Pilihan ${label} sesuai dengan konsep ${input.topic}. Verifikasi kembali kebenaran materi sebelum menerima soal.`
      : `Pilihan ${label} belum tepat karena tidak sesuai dengan konsep ${input.topic}.`,
    sortOrder: optionIndex,
  }))

  return {
    questionText: `(${input.difficulty.toLowerCase()}) Dalam materi ${input.topic} pada ${input.subject}, pernyataan manakah yang paling tepat?`,
    options,
    mediaNeed: input.additionalInstruction?.toLowerCase().includes('gambar') ? 'REQUIRED' : 'NOT_REQUIRED',
  }
}

export function validateOptions(options: GeneratedOption[]) {
  return options.length >= 4
    && options.length <= 5
    && new Set(options.map((option) => option.label)).size === options.length
    && options.filter((option) => option.isCorrect).length === 1
    && options.every((option) => option.text.trim() && option.explanation.trim())
}

export function calculateScore(correctCount: number, totalQuestions: number) {
  if (totalQuestions < 1) throw new Error('Attempt must contain at least one question')
  return Math.round((correctCount / totalQuestions) * 100)
}

export type ReadinessQuestion = { status: string; mediaNeed: string; mediaCount: number }

export function packageReadinessIssue(questions: ReadinessQuestion[]) {
  if (!questions.length) return 'Tambahkan minimal satu soal tervalidasi.'
  if (questions.some((question) => question.status !== 'VALIDATED')) return 'Semua soal harus tervalidasi.'
  if (questions.some((question) => question.mediaNeed === 'REQUIRED' && question.mediaCount === 0)) {
    return 'Ada soal wajib-media yang belum memiliki media.'
  }
  return null
}

export function toPublicQuizQuestion<T extends { id: string; questionText: string; options: { id: string; label: string; text: string }[] }>(question: T) {
  return {
    id: question.id,
    questionText: question.questionText,
    options: question.options.map(({ id, label, text }) => ({ id, label, text })),
  }
}
