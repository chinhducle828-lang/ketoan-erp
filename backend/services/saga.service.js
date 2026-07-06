import { randomUUID } from 'crypto';

const sagaStore = new Map();

export const createSaga = ({ sagaId = randomUUID(), steps = [], compensations = [] } = {}) => ({
  id: sagaId,
  steps,
  compensations,
  state: 'started'
});

export const clearSagaState = () => {
  sagaStore.clear();
};

export const runSaga = async ({ sagaId = randomUUID(), steps = [], compensations = [] }) => {
  const saga = createSaga({ sagaId, steps, compensations });
  sagaStore.set(saga.id, saga);

  try {
    for (const step of steps) {
      if (step?.execute) {
        await step.execute();
      }
    }

    saga.state = 'succeeded';
    sagaStore.set(saga.id, saga);
    return { sagaId: saga.id, status: 'succeeded' };
  } catch (error) {
    saga.state = 'failed';
    saga.error = error.message;
    sagaStore.set(saga.id, saga);

    for (const compensation of compensations) {
      if (compensation?.execute) {
        try {
          await compensation.execute();
        } catch (compensationError) {
          saga.compensationError = compensationError.message;
          sagaStore.set(saga.id, saga);
        }
      }
    }

    return { sagaId: saga.id, status: 'failed', error: error.message };
  }
};

export const getSagaState = (sagaId) => sagaStore.get(sagaId) || null;
