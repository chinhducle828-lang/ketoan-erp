import { runSaga, clearSagaState } from '../services/saga.service.js';

describe('saga orchestration', () => {
  beforeEach(() => {
    clearSagaState();
  });

  test('runs compensating steps when a later step fails', async () => {
    const events = [];

    const result = await runSaga({
      sagaId: 'test-saga',
      steps: [
        {
          name: 'prepare',
          execute: async () => {
            events.push('prepare');
          }
        },
        {
          name: 'commit',
          execute: async () => {
            events.push('commit');
            throw new Error('boom');
          }
        }
      ],
      compensations: [
        {
          name: 'rollback',
          execute: async () => {
            events.push('rollback');
          }
        }
      ]
    });

    expect(result.status).toBe('failed');
    expect(events).toEqual(['prepare', 'commit', 'rollback']);
    expect(result.error).toContain('boom');
  });
});
