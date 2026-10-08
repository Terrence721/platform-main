import { TestBed } from '@angular/core/testing';
import {
  AUDIO_CONTEXT,
  SOUND_MUTED_KEY,
  SOUND_STORAGE,
  Sounds,
  TONES,
  VOLUME,
} from './sounds';

/** What a played note was: its pitch, start, stop and loudest gain. */
interface Played {
  frequency: number;
  start: number;
  stop: number;
  peak: number;
}

/**
 * A stand-in for the browser's audio, recording each note played: the
 * test browser has none.
 */
class FakeAudio {
  currentTime = 10;
  state: 'running' | 'suspended' = 'running';
  readonly destination = {};
  readonly played: Played[] = [];
  readonly resume = vi.fn(async () => {
    this.state = 'running';
  });

  createOscillator() {
    const note: Partial<Played> = {};
    const node = {
      type: '',
      frequency: {
        setValueAtTime: (value: number) => (note.frequency = value),
      },
      connect: (target: unknown) => target,
      start: (at: number) => (note.start = at),
      stop: (at: number) => {
        note.stop = at;
        this.played.push(note as Played);
      },
    };
    this.lastNote = note;
    return node;
  }

  createGain() {
    const note = this.lastNote;
    return {
      gain: {
        setValueAtTime: () => undefined,
        exponentialRampToValueAtTime: (value: number) => {
          note.peak = Math.max(note.peak ?? 0, value);
        },
      },
      connect: (target: unknown) => target,
    };
  }

  private lastNote: Partial<Played> = {};
}

/** An in-memory stand-in for the browser's storage. */
function fakeStorage(saved: Record<string, string> = {}) {
  return {
    getItem: (key: string) => saved[key] ?? null,
    setItem: (key: string, value: string) => (saved[key] = value),
    saved,
  };
}

describe('Sounds', () => {
  function create({
    audio = new FakeAudio() as FakeAudio | null,
    storage = fakeStorage() as Pick<Storage, 'getItem' | 'setItem'> | null,
  } = {}) {
    const openAudio = vi.fn(() => audio);
    TestBed.configureTestingModule({
      providers: [
        { provide: AUDIO_CONTEXT, useValue: openAudio },
        { provide: SOUND_STORAGE, useValue: storage },
      ],
    });
    return { sounds: TestBed.inject(Sounds), audio, openAudio };
  }

  it('is on until someone mutes it', () => {
    expect(create().sounds.muted()).toBe(false);
  });

  it.each([
    ['success', [660, 880]],
    ['error', [220]],
    ['arrival', [988]],
  ] as const)('plays %s as its notes, quietly', (kind, frequencies) => {
    const { sounds, audio } = create();

    sounds.play(kind);

    expect(audio?.played.map(({ frequency }) => frequency)).toEqual(
      frequencies
    );
    expect(audio?.played.every(({ peak }) => peak === VOLUME)).toBe(true);
  });

  it('plays each note at its time from now, for its length', () => {
    const { sounds, audio } = create();

    sounds.play('success');

    // currentTime is 10.
    expect(audio?.played.map(({ start, stop }) => [start, stop])).toEqual(
      TONES.success.map(({ start, duration }) => [
        10 + start,
        10 + start + duration,
      ])
    );
  });

  it('plays nothing while muted, and again once unmuted', () => {
    const { sounds, audio } = create();

    sounds.setMuted(true);
    sounds.play('success');
    expect(audio?.played).toEqual([]);

    sounds.setMuted(false);
    sounds.play('error');
    expect(audio?.played).toHaveLength(1);
  });

  it('remembers the choice in the browser, and reads it back next visit', () => {
    const storage = fakeStorage();
    create({ storage }).sounds.setMuted(true);

    expect(storage.saved).toEqual({ [SOUND_MUTED_KEY]: 'true' });
    TestBed.resetTestingModule();
    expect(create({ storage }).sounds.muted()).toBe(true);
  });

  it('opens the audio on the first sound, not before, and only once', () => {
    const { sounds, openAudio } = create();
    expect(openAudio).not.toHaveBeenCalled();

    sounds.play('success');
    sounds.play('arrival');

    expect(openAudio).toHaveBeenCalledOnce();
  });

  it('wakes audio the browser had paused', () => {
    const audio = new FakeAudio();
    audio.state = 'suspended';
    const { sounds } = create({ audio });

    sounds.play('success');

    expect(audio.resume).toHaveBeenCalledOnce();
  });

  it('plays nothing, and fails nothing, where there is no audio', () => {
    const { sounds } = create({ audio: null });

    expect(() => sounds.play('success')).not.toThrow();
  });

  it('never lets a broken audio break what it goes with', () => {
    const broken = new FakeAudio();
    broken.createOscillator = () => {
      throw new Error('The audio refused.');
    };
    const { sounds } = create({ audio: broken });

    expect(() => sounds.play('success')).not.toThrow();
  });

  it('still mutes for this visit where storage is not allowed', () => {
    const blocked = {
      getItem: () => {
        throw new Error('Storage is blocked.');
      },
      setItem: () => {
        throw new Error('Storage is blocked.');
      },
    };
    const { sounds, audio } = create({ storage: blocked });

    expect(sounds.muted()).toBe(false);
    sounds.setMuted(true);
    sounds.play('success');

    expect(sounds.muted()).toBe(true);
    expect(audio?.played).toEqual([]);
  });
});
