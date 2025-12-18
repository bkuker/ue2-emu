export type Word = number & { __brand: 'word' };
import { fractionalDecToWord, wordToFractionalDec } from "./types";
import assert from "assert";

const BITS = 24;
const bitMask = 0b11111111_11111111_11111111;
const magMask = 0b11111111_11111111_11111110;
const sigMask = 0b00000000_00000000_00000001;
const msbMask = 0b10000000_00000000_00000000;

const A = 0.42;
const B = 0.69;
const P = A * B;
console.log(`${A} * ${B} = ${P}`);

const Aw = fractionalDecToWord(A);
const Bw = fractionalDecToWord(B);
const Pw = multiply(Aw, Bw);
console.log(`\n${Aw} * ${Bw} = ${Pw}`);

console.log(`\n${wordToFractionalDec(Aw)} * ${wordToFractionalDec(Bw)} = ${wordToFractionalDec(Pw)}`);

function multiply(A: number, B : number): number{


    //discard signs for now
    A = A & magMask;
    B = B & magMask;
    let P = 0;
    for ( let i = 0; i < BITS-1; i++){
        //console.log("\nIteration", i);
        //console.log("A", A.toString(2).padStart(23, "0"));
        //console.log("B", B.toString(2).padStart(23, "0"));
        //console.log("P", P.toString(2).padStart(23, "0"));

        B = (B >> 1) & bitMask;
        if ( A & msbMask ){
            P = (P+B) & bitMask;
        }
        A = (A << 1) & bitMask;
    }

    return P & magMask;
}

