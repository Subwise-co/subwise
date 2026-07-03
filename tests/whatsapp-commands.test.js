import { describe, it, expect } from 'vitest'
import {
  classifyInboundCommand,
  getCancellationSteps,
  CANCEL_STEPS,
} from '@/lib/whatsapp-commands'

describe('classifyInboundCommand', () => {
  it('classifies STOP/unsubscribe/NO variants', () => {
    expect(classifyInboundCommand('STOP').type).toBe('stop')
    expect(classifyInboundCommand('stop').type).toBe('stop')
    expect(classifyInboundCommand('No thanks').type).toBe('stop')
    expect(classifyInboundCommand('UNSUBSCRIBE me').type).toBe('stop')
  })

  it('classifies confirmation', () => {
    expect(classifyInboundCommand('YES').type).toBe('confirm')
    expect(classifyInboundCommand('y').type).toBe('confirm')
  })

  it('classifies START', () => {
    expect(classifyInboundCommand('start').type).toBe('start')
  })

  it('classifies PAUSE and RESUME (weekly scan control)', () => {
    expect(classifyInboundCommand('PAUSE').type).toBe('pause')
    expect(classifyInboundCommand('pause').type).toBe('pause')
    expect(classifyInboundCommand('RESUME').type).toBe('resume')
    expect(classifyInboundCommand('resume').type).toBe('resume')
  })

  it('parses CANCEL with the service name', () => {
    expect(classifyInboundCommand('CANCEL Netflix')).toEqual({
      type: 'cancel',
      service: 'Netflix',
    })
    expect(classifyInboundCommand('cancel  Amazon Prime ')).toEqual({
      type: 'cancel',
      service: 'Amazon Prime',
    })
  })

  it('returns help for unrecognized text and ignore for empty', () => {
    expect(classifyInboundCommand('hello there').type).toBe('help')
    expect(classifyInboundCommand('').type).toBe('ignore')
    expect(classifyInboundCommand(null).type).toBe('ignore')
  })
})

describe('getCancellationSteps', () => {
  it('returns known steps case-insensitively', () => {
    expect(getCancellationSteps('Netflix')).toBe(CANCEL_STEPS.netflix)
    expect(getCancellationSteps('amazon prime')).toBe(CANCEL_STEPS['amazon prime'])
  })

  it('falls back with UPI mandate guidance for unknown services', () => {
    const steps = getCancellationSteps('SomeNewApp')
    expect(steps).toContain('SomeNewApp')
    expect(steps).toContain('UPI mandate')
    expect(steps).toContain('GPay')
  })
})
