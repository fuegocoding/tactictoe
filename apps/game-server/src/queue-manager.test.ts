import { describe, it, expect, beforeEach } from 'vitest';
import { QueueManager, type QueueEntry } from './queue-manager.js';

describe('QueueManager', () => {
  let qm: QueueManager;

  beforeEach(() => {
    qm = new QueueManager();
  });

  const entry1: QueueEntry = {
    socketId: 's1',
    guestId: 'g1',
    displayName: 'Player 1',
    joinedAt: 1000,
  };

  const entry2: QueueEntry = {
    socketId: 's2',
    guestId: 'g2',
    displayName: 'Player 2',
    joinedAt: 1100,
  };

  describe('join', () => {
    it('should add an entry to the casual queue', () => {
      qm.join('v1', entry1);
      expect(qm.getPosition('s1')).toBe(1);
    });

    it('should prevent duplicate guestId in the casual queue', () => {
      qm.join('v1', entry1);
      const duplicate = { ...entry2, guestId: 'g1' };
      qm.join('v1', duplicate);
      expect(qm.getPosition('s2')).toBe(0);
    });
  });

  describe('joinRated', () => {
    it('should add an entry to the rated queue', () => {
      qm.joinRated('v1', entry1);
      expect(qm.getPosition('s1')).toBe(1);
    });

    it('should prevent duplicate guestId in the rated queue', () => {
      qm.joinRated('v1', entry1);
      const duplicate = { ...entry2, guestId: 'g1' };
      qm.joinRated('v1', duplicate);
      expect(qm.getPosition('s2')).toBe(0);
    });
  });

  describe('leave', () => {
    it('should remove an entry from the casual queue', () => {
      qm.join('v1', entry1);
      qm.leave('s1');
      expect(qm.getPosition('s1')).toBe(0);
    });

    it('should remove an entry from the rated queue', () => {
      qm.joinRated('v1', entry1);
      qm.leave('s1');
      expect(qm.getPosition('s1')).toBe(0);
    });
  });

  describe('tryMatch', () => {
    it('should return null when there is only one player in the casual queue', () => {
      qm.join('v1', entry1);
      expect(qm.tryMatch('v1')).toBeNull();
    });

    it('should return a pair of players in FIFO order and remove them from the casual queue', () => {
      qm.join('v1', entry1);
      qm.join('v1', entry2);
      const match = qm.tryMatch('v1');
      expect(match).toEqual([entry1, entry2]);
      expect(qm.getPosition('s1')).toBe(0);
      expect(qm.getPosition('s2')).toBe(0);
    });
  });

  describe('tryMatchRated', () => {
    it('should return null when there is only one player in the rated queue', () => {
      qm.joinRated('v1', entry1);
      expect(qm.tryMatchRated('v1')).toBeNull();
    });

    it('should return a pair of players in FIFO order and remove them from the rated queue', () => {
      qm.joinRated('v1', entry1);
      qm.joinRated('v1', entry2);
      const match = qm.tryMatchRated('v1');
      expect(match).toEqual([entry1, entry2]);
      expect(qm.getPosition('s1')).toBe(0);
      expect(qm.getPosition('s2')).toBe(0);
    });
  });

  describe('findSocket', () => {
    it('should return the variantId for a socket in the casual queue', () => {
      qm.join('v1', entry1);
      expect(qm.findSocket('s1')).toBe('v1');
    });

    it('should return the variantId for a socket in the rated queue', () => {
      qm.joinRated('v2', entry2);
      expect(qm.findSocket('s2')).toBe('v2');
    });

    it('should return null for a non-existent socket', () => {
      expect(qm.findSocket('unknown')).toBeNull();
    });
  });

  describe('getPosition', () => {
    it('should return the correct 1-based position in the casual queue', () => {
      qm.join('v1', entry1);
      qm.join('v1', entry2);
      expect(qm.getPosition('s1')).toBe(1);
      expect(qm.getPosition('s2')).toBe(2);
    });

    it('should return the correct 1-based position in the rated queue', () => {
      qm.joinRated('v1', entry1);
      qm.joinRated('v1', entry2);
      expect(qm.getPosition('s1')).toBe(1);
      expect(qm.getPosition('s2')).toBe(2);
    });

    it('should return 0 if the socket is not in any queue', () => {
      expect(qm.getPosition('unknown')).toBe(0);
    });
  });
});
