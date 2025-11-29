import chalk from "chalk";
import { workerData } from "worker_threads";

type Word = number & { __brand: 'word' };
type Time = number & { __brand: 'time' };
type LineNo = number & { __brand: 'lineNo' };

type Loc = {
    line: LineNo,
    time: Time
};

const ZERO = 0 as Word;
const wONE = ~ZERO as Word;

class Drum {
    time: Time = 0 as Time;
    lines: Word[][];
    constructor(lineCount: number, wordCount: number) {
        this.lines = new Array(lineCount).fill(null).map(() => Array(wordCount).fill(0 as Word));
    }

    read(line: LineNo): Word {
        this.dumpReads.push({ line, time: this.time });
        return this.lines[line][this.time];
    }

    write(line: LineNo, value: Word) {
        this.lines[line][this.time] = value;
        this.dumpWrites.push({ line, time: this.time });
    }

    step() {
        this.time = (this.time + 1) % (this.lines[0].length) as Time;
    }

    //Non-Physical, used for testing
    poke(line: LineNo, time: Time, value: Word) {
        this.lines[line][time] = value;
    }

    dumpReads: Loc[] = [];
    dumpWrites: Loc[] = [];
    dump() {
        let header = "Line \\ Time: 0";
        let tMax = 0;
        for (let l = 0; l < this.lines.length; l++) {
            for (let t = 0; t < this.lines[l].length; t++) {
                let read = this.dumpReads.some(loc => loc.line == l && loc.time == t);
                let written = this.dumpWrites.some(loc => loc.line == l && loc.time == t);
                let n = this.lines[l][t];
                if (n || read || written)
                    if (t > tMax)
                        tMax = t+1;
            }
        }
        for (let t = 1; t < tMax; t++) {
            header += t.toString().padStart(7, " ");
        }
        console.log(header);
        for (let l = 0; l < this.lines.length; l++) {
            let show = false;
            let line = "    " + l.toString().padStart(2, "0") + ": "
            for (let t = 0; t < tMax; t++) {
                let read = this.dumpReads.some(loc => loc.line == l && loc.time == t);
                let written = this.dumpWrites.some(loc => loc.line == l && loc.time == t);
                let n = this.lines[l][t];
                if (read || written || n)
                    show = true;
                let v = n.toString(16).padStart(6, "0");
                if (written && read)
                    v = chalk.magenta(v)
                else if (written)
                    v = chalk.red(v);
                else if (read)
                    v = chalk.blue(v);
                else if (n == 0)
                    v = chalk.black(v);
                line += v;
                if (t < tMax - 1)
                    line += chalk.black(",");
            }
            if (show)
                console.log(line);
        }
        this.dumpReads = [];
        this.dumpWrites = [];
    }
}

enum OpCode {
    Load = 0b0000,
    Add = 0b0001,
    Sub = 0b0010,
    Inc = 0b0011,
    Store = 0b0100,
    AddLEQ = 0b0101,
    SubLEQ = 0b0110,
    IncLEQ = 0b0111,
    NOP = 0b1000,
};

class Instruction {
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

    parse(s: string) {
        //DL:DT OP NL:NT

        const op = s.split(/[ :]+/);

        this.dataLine = parseInt(op[0]) as LineNo;
        this.dataTime = parseInt(op[1]) as Time;
        this.opCode = OpCode[op[2] as keyof typeof OpCode];
        this.nextLine = parseInt(op[3]) as LineNo;
        this.nextTime = parseInt(op[4]) as Time;
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

    inFetch = true;

    step(): void {
        this.drum.step();

        if (this.inFetch) {
            //Fetch Instruction
            if (this.drum.time == this.instruction.nextTime + (this.branch ? 1 : 0) as Time) {
                console.log("---------------------")
                console.log(`...done waiting for Time ${this.instruction.nextTime}`);
                console.log(`Fetching new instruction from ${this.instruction.nextLine}:${this.instruction.nextTime}`);
                this.instruction.w = this.drum.read(this.instruction.nextLine);
                this.inFetch = false;
                this.branch = false;
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

                    if (this.instruction.opCode == 0b0100) {
                        //0100 Store:  LINE.TIME <- ACC
                        this.drum.write(this.instruction.dataLine, this.ACC);
                        console.log(`ACC  (${oldACC}) -> ${this.instruction.dataLine}:${this.instruction.dataTime}`)
                    }

                    if (this.instruction.opCode == 0b0000) {
                        //0000 Load:   ACC <- LINE.TIME
                        const dataIn = this.drum.read(this.instruction.dataLine);
                        this.ACC = dataIn;
                        console.log(`ACC <- ${this.instruction.dataLine}:${this.instruction.dataTime} (${dataIn})`);
                    }


                    if ((this.instruction.opCode & 0b0011) == 0b0001) {
                        //0001 Add:    ACC <- LINE.TIME + ACC
                        //0101 AddLEQ: ACC <- LINE.TIME + ACC, IF ACC = 0 THEN NEXT = NEXT + 1
                        const dataIn = this.drum.read(this.instruction.dataLine);
                        this.ACC = this.ACC + this.drum.read(this.instruction.dataLine) as Word;
                        console.log(`ACC (${oldACC}) += ${this.instruction.dataLine}:${this.instruction.dataTime} (${dataIn}) = ${this.ACC}`);
                    }

                    if ((this.instruction.opCode & 0b0011) == 0b0010) {
                        //0010 Sub:    ACC <- LINE.TIME - ACC
                        //0110 SubLEQ: ACC <- LINE.TIME - ACC, IF ACC = 0 THEN NEXT = NEXT + 1
                        const dataIn = this.drum.read(this.instruction.dataLine);
                        this.ACC = this.ACC - this.drum.read(this.instruction.dataLine) as Word;
                        console.log(`ACC (${oldACC}) -= ${this.instruction.dataLine}:${this.instruction.dataTime} (${dataIn}) = ${this.ACC}`);
                    }

                    if ((this.instruction.opCode & 0b0011) == 0b0011) {
                        //0011 Inc:    ACC <- ACC + 1
                        //0111 IncLEQ: ACC <- LINE.TIME + 1, IF ACC = 0 THEN NEXT = NEXT + 1
                        const dataIn = this.drum.read(this.instruction.dataLine);
                        this.ACC = this.ACC + 1 as Word;
                        console.log(`ACC (${oldACC}) += 1 = ${this.ACC}`);
                    }

                    if ((this.instruction.opCode & 0b0100)) {
                        //01xx LEQ IF ACC = 0 THEN NEXT = NEXT + 1
                        this.branch = this.ACC == 0;
                    }
                } else {
                    //IO Instruction
                    /*
                    If fourth bit is 1, that indicates I/O operations
                    TIME.1XXX:  1XXX = 8 unique I/O operations
                                TIME = Device code, like MMIO

                    1000 PL:    ACC <- Parallel from device
                    1001 PS:    Parallel to device <- ACC
                    */
                }
                console.log(`Accumulator: ${this.ACC == oldACC ? this.ACC : chalk.red(this.ACC)}`);
                this.drum.dump();
                this.inFetch = true;
            }
        }
    }


    run(steps: number) {
        let count = 0;
        while (true) {
            count++;
            if (count > steps) {
                console.log("Stopping after a while");
                break;
            }
            this.step();
        }
    }
}

let ue2 = new UE2();


const code = `
;LOC    DL:DT OP NL:NT
; Startup kinda weird, if IR gets initialized with all zeros it ends
; up loading 00.00 into ACC. Maybe opcode 0 should be a NOOP?
;

00:00   00:00   NOP     01:01   ;NOP Goto 01:01
01:01   23:02   Load    01:03   ;ACC <- 23:02
01:03   23:04   Add     01:05   ;ACC += 23:04
01:05   23:06   Store   01:07   ;ACC -> 23:06

01:07   00:00   NOP     01:07   ;NOP Loop

23:02   DATA  37
23:04   DATA  5
`;


parseAndPoke(code, ue2.drum);

ue2.run(200);


////////////////////////////////////////////////////////////////
// Code Parsing

function parseLine(line: string) {
    const index = line.indexOf(" ");
    const first = line.slice(0, index).trim();
    const rest = line.slice(index + 1).trim();

    const [locLS, locTS] = first.split(":");
    const loc: Loc = {
        line: parseInt(locLS) as LineNo,
        time: parseInt(locTS) as Time
    };

    if (rest.startsWith("DATA")) {
        return { loc, word: parseInt(rest.split(/\s+/)[1]) as Word };
    }

    const i = new Instruction();
    i.parse(rest);

    return { loc, word: i.w }
}

function parseCode(code: string) {
    let lines = code.split("\n");
    console.log(chalk.dim(chalk.yellow(code)))
    return lines
        .map(s => s.replace(/;.*/, "")) //remove comments
        .map(s => s.trim()) //Trim Whitespace
        .filter(s => s.length)  //Remove blanks
        .map(parseLine)  //Convert to location, word pairs
}

function parseAndPoke(code: string, drum: Drum) {
    parseCode(code).forEach(({ loc, word }) => {
        drum.poke(loc.line, loc.time, word);
    });
}

