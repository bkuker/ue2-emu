;LOC    DATA    OP      NEXT
;LL:LT  DL:DT   OP      NL:NT
;LL:LT  Device  IN/OUT  NL:NT

;    while ( B ){
;       B = (B >> 1);
;       if ( A & msbMask ){
;           P = (P+B);
;       }
;       A = (A << 1);
;   }
;
;   TODO: Code never stops, it just loops adding zero
;   TODO: Ignores sign bits

;B = (B >> 1)
00:00   01:01   Load    00:02   ;Load B into ACC
00:02   00:03   AND     00:04   ;Clear LSB
00:03   DATA    0b11111111_11111111_11111110
00:04   00:05   ROT     00:06   ;Rotate one right
00:05   DATA    0b11111111_11111111_11111110
00:06   01:01   Store   00:07   ;Store to B

;if ( A & MSB MASK ){
00:07   01:00   Load    00:08   ;Loat A into ACC
00:08   00:09   AND     00:10   ;And with MASK
00:09   DATA    0b01000000_00000000_00000000
00:10   00:11   BEQ     00:12   ; ACC == 0? goto 13 else 12

;   P = (P+B)
00:12   01:02   Load    00:14   ; ACC = P
00:14   01:01   Add     00:15   ; Add B
00:15   01:02   Store   00:13   ; Store to P
;}

;A = (A << 1)
00:13   01:00   Load    00:16   ; Load A into ACC
00:16   00:17   AND     00:18   ; Clear highest bitMask
00:17   DATA    0b01111111_11111111_11111111
00:18   00:19   ROT     00:20   ;Rotate one left
00:19   DATA    1
00:20   01:00   Store   00:00


01:00   DATA    0.42            ; A = 0.42
01:01   DATA    0.69            ; B = 0.69
01:02   DATA    0               ; P : Product