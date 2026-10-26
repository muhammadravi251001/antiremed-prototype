import { describe, expect, it } from 'vitest'
import { calculateScore, generateDemoQuestion, packageReadinessIssue, toPublicQuizQuestion, validateOptions } from '../api/domain'

describe('demo question generation', () => {
  it('creates four or five unique options with exactly one answer and explanations', () => {
    const question = generateDemoQuestion({
      educationLevel: 'SMP',
      grade: '8',
      subject: 'Matematika',
      topic: 'Pecahan',
      difficulty: 'MEDIUM',
      optionCount: 5,
    }, 0)
    expect(question.options).toHaveLength(5)
    expect(validateOptions(question.options)).toBe(true)
    expect(question.options.filter((option) => option.isCorrect)).toHaveLength(1)
    expect(question.options.every((option) => option.explanation.trim())).toBe(true)
  })

  it('detects duplicate labels and missing explanations', () => {
    const options = generateDemoQuestion({
      educationLevel: 'SD',
      grade: '5',
      subject: 'Matematika',
      topic: 'Pecahan',
      difficulty: 'EASY',
      optionCount: 4,
    }, 1).options
    expect(validateOptions(options.map((option, index) => ({ ...option, label: index === 1 ? 'A' : option.label })))).toBe(false)
    expect(validateOptions(options.map((option, index) => index === 0 ? { ...option, explanation: '' } : option))).toBe(false)
  })
})

describe('package readiness', () => {
  it('requires at least one validated question', () => {
    expect(packageReadinessIssue([])).toMatch(/minimal satu/)
    expect(packageReadinessIssue([{ status: 'NEEDS_REVIEW', mediaNeed: 'NOT_REQUIRED', mediaCount: 0 }])).toMatch(/tervalidasi/)
  })

  it('requires media for questions that need it and allows explicit exclusions', () => {
    expect(packageReadinessIssue([{ status: 'VALIDATED', mediaNeed: 'REQUIRED', mediaCount: 0 }])).toMatch(/wajib-media/)
    expect(packageReadinessIssue([{ status: 'VALIDATED', mediaNeed: 'LINKED', mediaCount: 1 }])).toBeNull()
    expect(packageReadinessIssue([{ status: 'VALIDATED', mediaNeed: 'NOT_REQUIRED', mediaCount: 0 }])).toBeNull()
  })
})

describe('quiz integrity', () => {
  it('calculates score on the server rounding to an integer', () => {
    expect(calculateScore(2, 3)).toBe(67)
    expect(calculateScore(0, 4)).toBe(0)
  })

  it('does not expose correctness or explanations before submission', () => {
    const publicQuestion = toPublicQuizQuestion({
      id: 'q1',
      questionText: 'Question?',
      options: [{ id: 'a1', label: 'A', text: 'Answer', isCorrect: true, explanation: 'Secret' }],
    })
    expect(publicQuestion.options[0]).toEqual({ id: 'a1', label: 'A', text: 'Answer' })
    expect(publicQuestion.options[0]).not.toHaveProperty('isCorrect')
    expect(publicQuestion.options[0]).not.toHaveProperty('explanation')
  })
})