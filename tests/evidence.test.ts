import { describe, expect, it } from 'vitest';
import {
  normalizeForMatch,
  quoteInTranscript,
  textHasMarkers,
  verifyEvidence,
} from '../src/core/evidence.js';
import type { Evidence, Turn } from '../src/core/types.js';

/**
 * Detection-matcher contract:
 *  - strict matching first; morphology tolerance only where it is safe;
 *  - quote VERIFICATION stays strict — a fabricated quote may never verify.
 */

const turns: Turn[] = [
  { role: 'student', text: 'मैडम, अगर 5 − 3 है 2, तो 3 − 5 भी 2 क्यों नहीं?', ts: 0 },
  {
    role: 'teacher',
    text: 'अच्छा सवाल! पहले बताओ, तुम्हें क्या लगता है? देखो, ये 3 गोलियाँ लो।',
    ts: 1,
  },
];

describe('textHasMarkers (detection)', () => {
  it('matches exact forms strictly', () => {
    expect(textHasMarkers('ये 3 गोली लो', ['गोली'])).toBe(true);
  });

  it('matches inflected Devanagari forms of longer markers via the consonant skeleton', () => {
    // गोलियाँ / गोलियों carry the गोली skeleton (≥3 after stripping).
    expect(textHasMarkers('ये 3 गोलियाँ लो', ['गोलियाँ'])).toBe(true);
    expect(textHasMarkers('बत्तियों से दिखाओ', ['बत्तियों'])).toBe(true);
  });

  it('does not let short skeletons collide (किया must not match क्या)', () => {
    expect(textHasMarkers('सब सही किया!', ['क्या', 'क्यों'])).toBe(false);
  });

  it('requires 2-char markers to be standalone tokens (कम must not ride inside कमल)', () => {
    expect(textHasMarkers('गुलाब कमल से अलग है', ['कम'])).toBe(false);
    expect(textHasMarkers('चीज़ें कम होती हैं', ['कम'])).toBe(true);
  });

  it('treats a single punctuation marker as any question sentence', () => {
    expect(textHasMarkers('कितनी बचीं?', ['?'])).toBe(true);
    expect(textHasMarkers('बताओ न।', ['?'])).toBe(false);
  });

  it('never matches empty or whitespace markers', () => {
    expect(textHasMarkers('कुछ भी', ['', '  '])).toBe(false);
  });
});

describe('quote verification (strict)', () => {
  it('verifies a verbatim quote with Devanagari punctuation variants', () => {
    expect(quoteInTranscript('ये 3 गोलियाँ लो', turns)).toBe(true);
  });

  it('rejects a paraphrased or fabricated quote even when matras differ', () => {
    expect(quoteInTranscript('गोली लो', turns)).toBe(false);
    expect(quoteInTranscript('मैंने ऐसा कभी नहीं कहा', turns)).toBe(false);
  });

  it('never verifies student words as teacher evidence', () => {
    expect(quoteInTranscript('3 − 5 भी 2 क्यों नहीं', turns)).toBe(false);
  });

  it('abstains when all evidence is fabricated', () => {
    const evidence: Evidence[] = [
      { quote: 'मैंने कहा कि गोलियाँ दो', turnIndex: 1, verified: false },
      { quote: 'मैंने बिल्कुल यही सिखाया था', turnIndex: 1, verified: false },
    ];
    const { verifiedFactor } = verifyEvidence(evidence, turns);
    expect(verifiedFactor).toBe(0);
  });

  it('keeps evidence verified when quotes are real', () => {
    const evidence: Evidence[] = [
      { quote: 'ये 3 गोलियाँ लो', turnIndex: 1, verified: false },
    ];
    const { verifiedFactor, verifiedCount } = verifyEvidence(evidence, turns);
    expect(verifiedFactor).toBe(1);
    expect(verifiedCount).toBe(1);
    expect(evidence[0]!.verified).toBe(true);
  });
});

describe('normalizeForMatch', () => {
  it('collapses whitespace and quote variants but keeps matras', () => {
    expect(normalizeForMatch('  गोली   लो ')).toBe('गोली लो');
    expect(normalizeForMatch('“शाबाश”')).toBe('"शाबाश"');
    expect(normalizeForMatch('गोलि')).not.toBe(normalizeForMatch('गोली'));
  });
});
