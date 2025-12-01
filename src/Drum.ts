import { Word, Time, LineNo, Loc } from "./types";
import chalk from "chalk";

export default class Drum {
    time: Time = 0 as Time;
    lines: Word[][];
    revolutions = 0;

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
        if ( this.time == 0 )
            this.revolutions++;
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
                        tMax = t + 1;
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