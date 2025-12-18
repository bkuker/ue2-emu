import { Word, Time, LineNo, Loc, decToWord, fractionalDecToWord } from "./types";
import { Instruction } from "./ue2";
import Drum from "./Drum";
import chalk from "chalk";


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
        let s = rest.split(/\s+/)[1];
        let w = decToWord(parseInt(s)); //TODO Other types
        return { loc, word: w };
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

export function parseAndPoke(code: string, drum: Drum) {
    parseCode(code).forEach(({ loc, word }) => {
        drum.poke(loc.line, loc.time, word);
    });
}

