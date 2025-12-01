import chalk from "chalk";
import fs from 'node:fs';
import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import { Word, Time, LineNo, Loc } from "./types";
import Drum from "./Drum";
import { parseAndPoke } from "./parser";

const ZERO = 0 as Word;

enum OpCode {
    Load = 0b0000,
    Add = 0b0001,
    Sub = 0b0010,
    Inc = 0b0011,
    Store = 0b0100,
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
    Branch = 0,
    Halt = 1,
    TX = 2
}

export class Instruction {
    w: Word = ZERO;


    get opCode() /*  */ { return (this.w & 0b00000_00000_00000_00000_1111) >> 0; };
    get nextLine() /**/ { return (this.w & 0b11111_00000_00000_00000_0000) >> 19 as LineNo };
    get nextTime() /**/ { return (this.w & 0b00000_11111_00000_00000_0000) >> 14 as Time };
    get dataLine() /**/ { return (this.w & 0b00000_00000_11111_00000_0000) >> 9 as LineNo };
    get dataTime() /**/ { return (this.w & 0b00000_00000_00000_11111_0000) >> 4 as Time };

    set opCode(v: number) /*  */ { this.w = (this.w | (v << 0)) as Word; };
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

        this.opCode = OpCode[opS as keyof typeof OpCode];

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
                console.log(`Accumulator: ${oldACC}`)

                if ((this.instruction.opCode & 0b1000) == 0) {
                    //Normal Instruction

                    if (this.instruction.opCode == OpCode.Store) {
                        //0100 Store:  LINE.TIME <- ACC
                        this.drum.write(this.instruction.dataLine, this.ACC);
                        console.log(`ACC  (${oldACC}) -> ${this.instruction.dataLine}:${this.instruction.dataTime}`)
                    }

                    if (this.instruction.opCode == OpCode.Load) {
                        //0000 Load:   ACC <- LINE.TIME
                        const dataIn = this.drum.read(this.instruction.dataLine);
                        this.ACC = dataIn;
                        console.log(`ACC <- ${this.instruction.dataLine}:${this.instruction.dataTime} (${dataIn})`);
                    }


                    if ((this.instruction.opCode & 0b0011) == OpCode.Add) {
                        //0001 Add:    ACC <- LINE.TIME + ACC
                        //0101 AddLEQ: ACC <- LINE.TIME + ACC, IF ACC = 0 THEN NEXT = NEXT + 1
                        const dataIn = this.drum.read(this.instruction.dataLine);
                        this.ACC = this.ACC + this.drum.read(this.instruction.dataLine) as Word;
                        console.log(`ACC (${oldACC}) += ${this.instruction.dataLine}:${this.instruction.dataTime} (${dataIn}) = ${this.ACC}`);
                    }

                    if ((this.instruction.opCode & 0b0011) == OpCode.Sub) {
                        //0010 Sub:    ACC <- LINE.TIME - ACC
                        //0110 SubLEQ: ACC <- LINE.TIME - ACC, IF ACC = 0 THEN NEXT = NEXT + 1
                        const dataIn = this.drum.read(this.instruction.dataLine);
                        this.ACC = this.ACC - this.drum.read(this.instruction.dataLine) as Word;
                        console.log(`ACC (${oldACC}) -= ${this.instruction.dataLine}:${this.instruction.dataTime} (${dataIn}) = ${this.ACC}`);
                    }

                    if ((this.instruction.opCode & 0b0011) == OpCode.Inc) {
                        //0011 Inc:    ACC <- ACC + 1
                        //0111 IncLEQ: ACC <- LINE.TIME + 1, IF ACC = 0 THEN NEXT = NEXT + 1
                        const dataIn = this.drum.read(this.instruction.dataLine);
                        this.ACC = this.ACC + 1 as Word;
                        console.log(`ACC (${oldACC}) += 1 = ${this.ACC}`);
                    }
/*
                    if ((this.instruction.opCode & 0b0100)) {
                        //01xx LEQ IF ACC = 0 THEN NEXT = NEXT + 1
                        this.branch = this.ACC == 0;
                        console.log(chalk.green("Branch Set XXX"), this.i);
                    }*/
                } else {
                    //IO Instruction
                    /*
                    If fourth bit is 1, that indicates I/O operations
                    TIME.1XXX:  1XXX = 8 unique I/O operations
                                TIME = Device code, like MMIO

                    1000 PL:    ACC <- Parallel from device
                    1001 PS:    Parallel to device <- ACC
                    */
                    if (this.instruction.device == Device.TX && this.instruction.opCode == OpCode.Out) {
                        console.log("Terminal Write: " + chalk.yellowBright(this.ACC));
                        this.terminalOutput += " " + this.ACC;
                    }

                    if (this.instruction.device == Device.Halt && this.instruction.opCode == OpCode.Out) {
                        this.halt = true;
                        console.log(chalk.redBright("HALT"));
                    }

                    if (this.instruction.device == Device.Branch && this.instruction.opCode == OpCode.Out) {
                        if ( this.ACC == 0 ){
                            this.branch = true;
                            console.log(chalk.green("Branch Set"));
                        }
                    }

                }
                console.log(`Accumulator: ${this.ACC == oldACC ? this.ACC : chalk.red(this.ACC)}`);
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


const code = fs.readFileSync("src/fib.asm", 'utf-8');


parseAndPoke(code, ue2.drum);

ue2.run(-1)

//stepByStep();

async function stepByStep() {
    const rl = readline.createInterface({ input, output });
    while (!ue2.halt) {
        while (!ue2.step() && !ue2.halt);
        await rl.question('Enter to step...');
    }
    rl.close();
}

