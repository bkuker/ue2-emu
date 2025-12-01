export type Word = number & { __brand: 'word' };
export type Time = number & { __brand: 'time' };
export type LineNo = number & { __brand: 'lineNo' };

export type Loc = {
    line: LineNo,
    time: Time
};
