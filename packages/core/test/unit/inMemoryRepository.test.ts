import { describe } from 'vitest';
import { InMemoryAvalesRepository } from '../../src';
import { avalesRepositoryContract } from '../contract/avalesRepository.contract';

describe('InMemoryAvalesRepository (contract)', () => {
  const repo = new InMemoryAvalesRepository();
  avalesRepositoryContract(() => repo);
});
