import chalk from "chalk";
import fs from 'node:fs';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { BITS, Word, Time, LineNo, Loc, wordToFractionalDec, wordToDec, decToWord, wordToString, bitMask } from "./types";
import Drum from "./Drum";
import { parseAndPoke } from "./parser";

const ZERO = 0 as Word;

enum OpCode {
    Load = 0b0000,

    Add = 0b0001,
    Sub = 0b0010,

    ROT = 0b0011,

    AND = 0b0100,
    XOR = 0b0101,
    BEQ = 0b0110,

    Store = 0b0111,

    //AddLEQ = 0b0101,  Throw these away infavor of Out ACC -> Branch FF
    //SubLEQ = 0b0110,
    //IncLEQ = 0b0111,

    //Rotate..  Rotate ACC one bit in whichever direction is the one it gets shifted in?
    //              Maybe do it once for every bit set in the operand?
    //AND..     Bitwise AND
    //XOR..     Bitwise XOR

    In = 0b1000,
    Out = 0b1001
};

enum Device {
    Halt = 1,
    TX = 2
}

export class Instruction {
    w: Word = ZERO;


    get opCode() /*  */ { return (this.w & 0b00000_00000_00000_00000_1111) >> 0 as OpCode; };
    get nextLine() /**/ { return (this.w & 0b11111_00000_00000_00000_0000) >> 19 as LineNo };
    get nextTime() /**/ { return (this.w & 0b00000_11111_00000_00000_0000) >> 14 as Time };
    get dataLine() /**/ { return (this.w & 0b00000_00000_11111_00000_0000) >> 9 as LineNo };
    get dataTime() /**/ { return (this.w & 0b00000_00000_00000_11111_0000) >> 4 as Time };

    set opCode(v: OpCode) /*  */ { this.w = (this.w | (v << 0)) as Word; };
    set nextLine(v: LineNo) /**/ { this.w = (this.w | (v << 19)) as Word; };
    set nextTime(v: Time) /*  */ { this.w = (this.w | (v << 14)) as Word; };
    set dataLine(v: LineNo) /**/ { this.w = (this.w | (v << 9)) as Word; };
    set dataTime(v: Time) /*  */ { this.w = (this.w | (v << 4)) as Word; };


    //TODO NOTE IF DEVICE WERE STORED IN LINE THEN TIME COULD ALWAYS WAIT FOR DRUM
    //EVEN DIFFERENT VOLUME DINGS
    get device() { return this.dataTime as Device; }
    set device(v: Device) { this.dataTime = v as Time; }

    parse(s: string) {
        //DL:DT OP NL:NT

        const [addrS, opS, nextS] = s.split(/\s+/);

        if (!(opS in OpCode))
            throw new Error(`Invalid op code: ${opS}`);
        this.opCode = OpCode[opS as keyof typeof OpCode];

        console.log(s, this.opCode);

        if (this.opCode & 0b1000) {
            this.dataLine = 0 as LineNo; //IGNORED
            this.device = Device[addrS as keyof typeof Device];
        } else {
            const addr = addrS.split(":");
            this.dataLine = parseInt(addr[0]) as LineNo;
            this.dataTime = parseInt(addr[1]) as Time;
        }

        const next = nextS.split(":");
        this.nextLine = parseInt(next[0]) as LineNo;
        this.nextTime = parseInt(next[1]) as Time;

        this.dump();
    }

    dump() {
        console.log(`Instruction: Next ${this.nextLine}:${this.nextTime} Data ${this.dataLine}:${this.dataTime} OpCode ${OpCode[this.opCode]} ${this.opCode}`);
    }
}

class UE2 {

    //Magnetic Drum Memory
    drum = new Drum(32, 32);

    //Full word normal registers, stored on drum
    ACC: Word = ZERO;

    instruction: Instruction = new Instruction();

    branch: boolean = false;
    halt: boolean = false;

    inFetch = true;

    terminalOutput = "";

    step(): boolean {
        this.drum.step();

        if (this.halt)
            return false;

        if (this.inFetch) {
            //Fetch Instruction
            if (this.drum.time == this.instruction.nextTime + (this.branch ? 1 : 0) as Time) {
                console.log("---------------------")
                console.log(`...done waiting for Time ${this.instruction.nextTime}`);
                console.log(`Fetching new instruction from ${this.instruction.nextLine}:${this.instruction.nextTime}`);
                this.instruction.w = this.drum.read(this.instruction.nextLine);
                this.instruction.dump();
                this.inFetch = false;
                this.branch = false;
                return false;
            }
        } else {
            //Execute Instruction
            if (this.drum.time == this.instruction.dataTime) {
                console.log(`...done waiting for Time ${this.instruction.dataTime}`);
                this.instruction.dump();
                const oldACC = this.ACC;


                //Operations that LOAD from Drum and Change ACC
                if ([
                    OpCode.Load,
                    OpCode.Add,
                    OpCode.Sub,
                    OpCode.AND,
                    OpCode.ROT,
                    OpCode.XOR
                ].includes(this.instruction.opCode)) {
                    const operand = this.drum.read(this.instruction.dataLine);
                    console.log(`Accumulator: ${wordToString(this.ACC)}`);
                    console.log(`    Operand: ${wordToString(operand)}`);
                    console.log(`   Operator: ${OpCode[this.instruction.opCode]}`);
                    switch (this.instruction.opCode) {
                        case OpCode.Load:
                            this.ACC = operand;
                            break;
                        case OpCode.Add:
                            this.ACC = decToWord(wordToDec(this.ACC) + wordToDec(operand)) as Word;
                            break;
                        case OpCode.Sub:
                            this.ACC = decToWord(wordToDec(this.ACC) - wordToDec(operand)) as Word;
                            break;
                        case OpCode.AND:
                            this.ACC = (this.ACC & operand) as Word;
                            break;
                        case OpCode.ROT:
                            let shift : number = operand;
                            for (let i = 0; i < BITS && shift; i++) {
                                if (shift & 0x01) {
                                    let msb = this.ACC & (1 << 23);
                                    this.ACC = this.ACC << 1 as Word;
                                    this.ACC = ((this.ACC | (msb ? 1 : 0)) & bitMask) as Word;
                                }
                                shift = shift >> 1 as Word;
                                console.log(chalk.green(`Accumulator: ${wordToString(this.ACC)}`));
                            }
                            break;
                        case OpCode.XOR:
                            this.ACC = (this.ACC ^ operand) as Word;
                        break;
                    }

                    console.log(` ACC Result: ${this.ACC == oldACC ? wordToString(this.ACC) : chalk.red(wordToString(this.ACC))}`);

                } else if (this.instruction.opCode == OpCode.Store) {
                    //Store Operation
                    this.drum.write(this.instruction.dataLine, this.ACC);
                    console.log(`ACC  (${oldACC}) -> ${this.instruction.dataLine}:${this.instruction.dataTime}`)

                } else if (this.instruction.opCode == OpCode.BEQ) {
                    //Branch if zero
                    if (this.ACC == 0) {
                        this.branch = true;
                        console.log(chalk.green("Branch Set"));
                    }
                }

                if ((this.instruction.opCode & 0b1000) == 1) {
                    //IO Instruction
                    /*
                    If fourth bit is 1, that indicates I/O operations
                    TIME.1XXX:  1XXX = 8 unique I/O operations
                                TIME = Device code, like MMIO

                    1000 PL:    ACC <- Parallel from device
                    1001 PS:    Parallel to device <- ACC
                    */
                    if (this.instruction.device == Device.TX && this.instruction.opCode == OpCode.Out) {
                        console.log("Terminal Write: " + chalk.yellowBright(wordToDec(this.ACC)));
                        this.terminalOutput += " " + wordToDec(this.ACC);
                    }

                    if (this.instruction.device == Device.Halt && this.instruction.opCode == OpCode.Out) {
                        this.halt = true;
                        console.log(chalk.redBright("HALT"));
                    }

                }

                this.drum.dump();
                console.log("Terminal Contents: " + chalk.yellowBright(this.terminalOutput));
                console.log("Revolutions: " + this.drum.revolutions);
                this.inFetch = true;
                return true;
            }
        }
        return false;
    }


    run(steps: number) {
        let count = 0;
        while (!this.halt) {
            count++;
            if (count == steps) {
                console.log("Stopping after a while");
                break;
            }
            this.step();
        }
    }
}

let ue2 = new UE2();


const code = fs.readFileSync("src/rotateTest.asm", 'utf-8');


parseAndPoke(code, ue2.drum);

//ue2.run(-1)

stepByStep();

async function stepByStep() {
    const rl = readline.createInterface({ input, output });
    while (!ue2.halt) {
        while (!ue2.step() && !ue2.halt);
        await rl.question('Enter to step...');
    }
    rl.close();
}

