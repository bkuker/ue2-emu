import chalk from "chalk";

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
        //console.log("R", line, this.time, this.lines[line][this.time]);
        this.dumpReads.push({ line, time: this.time });

        return this.lines[line][this.time];
    }

    write(line: LineNo, value: Word) {
        //console.log("W", line, this.time, value);
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
        for (let t = 1; t < this.lines[0].length; t++) {
            header += t.toString().padStart(7, " ");
        }
        console.log(header);
        for (let l = 0; l < this.lines.length; l++) {
            let show = false;
            let line = "    " + l.toString().padStart(2, "0") + ": "
            for (let t = 0; t < this.lines[l].length; t++) {
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
                line += chalk.black(",");
            }
            if (show)
                console.log(line);
        }
        this.dumpReads = [];
        this.dumpWrites = [];
    }
}

class UE2 {

    //Magnetic Drum Memory
    drum = new Drum(32, 32);

    //Full word normal registers, stored on drum
    ACC: Word = ZERO;

    //Instruction latching shift register
    nextInstructionShiftRegister: Word = ZERO;
    instruction: Word = ZERO;

    //Helper functions for accessing certain parts of the instruction
    get iOpCode() { return (this.instruction & 0b1111); };
    get iTime() { return (this.instruction & 0b1111_0000) >> 4 as Time };
    get iNextLine() { return (this.instruction & 0b11111_0000_0000) >> 8 as LineNo };
    get iDataLine() { return (this.instruction & 0b11111_00000_0000_0000) >> 13 as LineNo };;

    step(): void {
        this.drum.step();

        //If it is not time, do nothing
        if (this.drum.time == this.iTime) {
            console.log("---------------------")
            console.log(`Instruction: Next Line ${this.iNextLine} Data Line ${this.iDataLine} Time: ${this.iTime} OpCode ${this.iOpCode}`);
            const oldACC = this.ACC;
            console.log(`Accumulator: ${oldACC}`)

            //Serial load the word at NEXT.TIME (previous instruction) into the IR register.
            console.log(`Fetching new instruction from ${this.iNextLine}:${this.iTime}`);
            this.nextInstructionShiftRegister = this.drum.read(this.iNextLine);

            



            //Serial output from ACC to LINE.TIME via specified modifiers.
            //Happens first because the old value of ACC is being written
            //Modifiers TODO
            if (this.iOpCode == 4) {
                console.log(`ACC ->  (${oldACC}) ${this.iDataLine}.${this.iTime}`)
                this.drum.write(this.iDataLine, this.ACC);
            }

            //Serial input from LINE.TIME to ACC via specified modifiers.
            //Modifiers TODO
            if (this.iOpCode == 0) {
                this.ACC = this.drum.read(this.iDataLine);
                console.log(`ACC <- ${this.iDataLine}:${this.iTime} (${this.ACC})`)
            } else if (this.iOpCode == 1) {
                this.ACC = this.ACC + this.drum.read(this.iDataLine) as Word;
                console.log(`ACC (${oldACC}) += ${this.iDataLine}:${this.iTime} (${this.drum.read(this.iDataLine)}) = ${this.ACC}`)
            }

            console.log(`Accumulator: ${this.ACC == oldACC? this.ACC : chalk.red(this.ACC)}`)

            //Latch in the new instruction
            console.log("Latching new instruction");
            this.instruction = this.nextInstructionShiftRegister;

            this.drum.dump();
        }
    }
}

let ue2 = new UE2();

/*
 LINE     NEXT    TIME   OPCD
000000   000000   0000   0000
*/
const code = `
;LOC    DL.NL.TT.OP ; Location  DataLine.NextLine.Time.Op

; Startup kinda weird, if IR gets initialized with all zeros it ends
; up loading 00.00 into ACC. Maybe opcode 0 should be a NOOP?

00:00   00.01.01.5  ; NOP, goto 01.01

01:01   23.01.02.0  ; Current instruction was loaded from line 1, word 1
                    ; Value at line 23, word 2 will be loaded into ACC
                    ; Next instruction is line 1 word 2
01:02   24.01.03.1  ; Current instruction was loaded from line 1, word 2
                    ; Value at line 24, word 3 will be added to ACC and stored in ACC
                    ; Next instruction is line 1 word 3
01:03   25.02.00.4  ; Current instruction was loaded from line 1, word 3
                    ; ACC will stored into line 25, word 0
                    ; Next instruction is line 02, word 0

23:02   DATA  37
24:03   DATA  5
`;

function parse(line: string) {

    const [locS, opS, constant] = line.split(/\s+/);
    const [locLS, locTS] = locS.split(":");
    const loc: Loc = {
        line: parseInt(locLS) as LineNo,
        time: parseInt(locTS) as Time
    };

    if (opS == "DATA") {
        return { loc, word: parseInt(constant) as Word };
    }

    const op = opS.split(".");
    let w = 0;
    w |= parseInt(op[0]) << 13; //Data Line
    w |= parseInt(op[1]) << 8;  //Next Line
    w |= parseInt(op[2]) << 4;  //Time
    w |= parseInt(op[3]) << 0;  //OP

    return { loc, word: w as Word }
}

let lines = code.split("\n");
console.log(chalk.dim(chalk.yellow(code)))
lines
    .map(s => s.replace(/;.*/, "")) //remove comments
    .map(s => s.trim()) //Trim Whitespace
    .filter(s => s.length)  //Remove blanks
    .map(parse)  //Convert to location, word pairs
    .forEach(({ loc, word }) => {
        ue2.drum.poke(loc.line, loc.time, word);
    });

let count = 0;
while (true) {
    count++;
    if (count > 200) {
        console.log("Stopping after a while");
        break;
    }
    ue2.step();
}