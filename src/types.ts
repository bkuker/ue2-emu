import assert from "assert";
import { sign } from "crypto";

export const BITS = 24;
export const bitMask = 0b11111111_11111111_11111111;
const magMask = 0b01111111_11111111_11111111;
const sigMask = 0b10000000_00000000_00000000;
const msbMask = 0b01000000_00000000_00000000;


export type Word = number & { __brand: 'word' };
export type Time = number & { __brand: 'time' };
export type LineNo = number & { __brand: 'lineNo' };

export type Loc = {
    line: LineNo,
    time: Time
};

export function wordToString(w: Word) {
    validateWord(w as Word);
    return `0x${w.toString(16).padStart(6, '0')} ${wordToDec(w)} ${wordToFractionalDec(w).toFixed(8)} 0b${w.toString(2).padStart(24, '0')}`
}
/*
console.log(wordToString(decToWord(0)));
console.log(wordToString(decToWord(1)));
console.log(wordToString(decToWord(-1)));

console.log(wordToString(decToWord(420)));
console.log(wordToString(decToWord(-420)));

console.log(wordToString(fractionalDecToWord(0.5)));
console.log(wordToString(fractionalDecToWord(-0.5)));

console.log(wordToString(fractionalDecToWord(0.125)));
console.log(wordToString(fractionalDecToWord(-0.125)));
*/

export function wordToDec(w: Word): number {
    validateWord(w as Word);

    if ( w & sigMask ){
        let abs = (~w & bitMask) + 1;
        return -abs;
    } else {
        return w as number;
    }

}

export function decToWord(n: number): Word {
    if ( n < 0 ){
        n = (n | sigMask) & bitMask
    }
    validateWord(n as Word);
    return n as Word;
}

export function wordToFractionalDec(w: Word): number {
    validateWord(w as Word);
    let v = wordToDec(w);
    return v / magMask;
}

export function fractionalDecToWord(w: number): Word {
    if (w <= -1 || w >= 1) {
        throw "Fractional decimals must be in the range (-1, 1): " + w;
    }
    w = w * magMask;
    w = Math.round(w);
    return decToWord(w);
}

export function validateWord(w: Word) {
    assert(w >= 0, "Words can't be negative " + w);
    assert(w <= 0xFFFFFF, "Words limited to 24 bits " + w);
}