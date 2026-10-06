import { inject, Injectable, InjectionToken, signal } from '@angular/core';
import type { TicketStatus } from '@helpdesk/contract';

/**
 * The help desk's sounds (#941): `success` when an action of yours goes
 * through, `error` when one is refused, `arrival` when something comes in
 * for you (a ticket assigned to you, a reply on the ticket you have open).
 */
export type SoundKind = 'success' | 'error' | 'arrival';

/** One note: its pitch in Hz, when it starts and how long it lasts, in s. */
interface Note {
  frequency: number;
  start: number;
  duration: number;
}

/**
 * The tones, made in code (no sound files): short and quiet. Success
 * rises, two notes; error is one low note; arrival is one bright note
 * that rings a little longer, so it is told apart from your own actions.
 */
export const TONES: Record<SoundKind, readonly Note[]> = {
  success: [
    { frequency: 660, start: 0, duration: 0.12 },
    { frequency: 880, start: 0.1, duration: 0.2 },
  ],
  error: [{ frequency: 220, start: 0, duration: 0.3 }],
  arrival: [{ frequency: 988, start: 0, duration: 0.45 }],
};

/**
 * Whether a status finishes the work (resolved or closed): moving a
 * ticket there plays `success`; other moves (open, pending) stay quiet.
 */
export function isFinished(status: TicketStatus): boolean {
  return status === 'resolved' || status === 'closed';
}

/** How loud at the start of each note, out of 1: quiet. */
export const VOLUME = 0.08;

/** Where the mute choice is remembered, in this browser. */
export const SOUND_MUTED_KEY = 'helpdesk.sound.muted';

/**
 * Gives the browser's audio, or `null` where there is none (the specs'
 * simulated browser). A seam the specs use to hear what is played.
 */
export const AUDIO_CONTEXT = new InjectionToken<() => AudioContext | null>(
  'AUDIO_CONTEXT',
  {
    providedIn: 'root',
    factory: () => () =>
      typeof AudioContext === 'undefined' ? null : new AudioContext(),
  }
);

/** Where the mute choice is kept; `null` where storage is not allowed. */
export const SOUND_STORAGE = new InjectionToken<Storage | null>(
  'SOUND_STORAGE',
  {
    providedIn: 'root',
    factory: () => {
      try {
        return globalThis.localStorage ?? null;
      } catch {
        return null;
      }
    },
  }
);

/**
 * Plays the help desk's sounds, unless they are muted. Sound is on until
 * someone mutes it; the choice is remembered in this browser. A sound is
 * never the only sign of anything: what it goes with is shown too. Where
 * there is no audio, or the browser refuses it (before any click on the
 * page), nothing plays and nothing fails.
 */
@Injectable({ providedIn: 'root' })
export class Sounds {
  private readonly openAudio = inject(AUDIO_CONTEXT);
  private readonly storage = inject(SOUND_STORAGE);
  private audio: AudioContext | null | undefined;

  /** Whether sounds are muted. */
  readonly muted = signal(this.read() === 'true');

  /** Mutes sounds, or turns them back on; remembered in this browser. */
  setMuted(muted: boolean): void {
    this.muted.set(muted);
    this.write(String(muted));
  }

  /** Plays a sound, unless muted. */
  play(kind: SoundKind): void {
    if (this.muted()) {
      return;
    }
    try {
      const audio = this.context();
      if (audio === null) {
        return;
      }
      if (audio.state === 'suspended') {
        void audio.resume();
      }
      for (const note of TONES[kind]) {
        this.playNote(audio, note);
      }
    } catch {
      // A sound is a nicety: never let it break what it goes with.
    }
  }

  /** The audio, opened on the first sound (browsers want a click first). */
  private context(): AudioContext | null {
    if (this.audio === undefined) {
      this.audio = this.openAudio();
    }
    return this.audio;
  }

  /** One note: a soft sine wave that fades out. */
  private playNote(audio: AudioContext, { frequency, start, duration }: Note) {
    const at = audio.currentTime + start;
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, at);
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(VOLUME, at + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, at + duration);
    oscillator.connect(gain).connect(audio.destination);
    oscillator.start(at);
    oscillator.stop(at + duration);
  }

  private read(): string | null {
    try {
      return this.storage?.getItem(SOUND_MUTED_KEY) ?? null;
    } catch {
      return null;
    }
  }

  private write(value: string): void {
    try {
      this.storage?.setItem(SOUND_MUTED_KEY, value);
    } catch {
      // Not remembered, then: it still holds for this visit.
    }
  }
}
