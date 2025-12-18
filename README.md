# ue2-emu

Crazy? Ideas

Add ROT and AND (and xor?)

ROT:
    ACC out -> ACC in
    Clock using operand VALUE + CLOCK
    Shifts one bit for every 1 in the operand
AND:
    Simple
XOR:
    Addition with carry suppressed

Branch:
    Idea one
        Port OUT command to copy ACC to branch register
        Either serial into branch FF set or parallel via or
        - takes one more instruction
        + adds BRZ style to anything in ACC
    Idea two
        One bit means after ANY instruction ACC is parallel
        loaded into branch FF. Parallel load means the new value
        - uses opcode space
        + maybe simpler
        + shorter code