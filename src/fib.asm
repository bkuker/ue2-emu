;LOC    DATA    OP      NEXT
;LL:LT  DL:DT   OP      NL:NT
;LL:LT  Device  IN/OUT  NL:NT

; Startup kinda weird, if IR gets initialized with all zeros it ends
; up loading 00.00 into ACC. Maybe opcode 0 should be a NOOP?

;Print the first 5 fibonacci numbers
;Not minimum access coded!

                                ;Load and print A
00:00   02:00   Load    00:01   ;Acc = A
00:01   TX      Out     00:02   ;Print ACC to terminal
                                ;Real hardware would only send the
                                ;first 8 bits perhaps?

                                ;Calculate C = A + B
00:02   02:01   Add     00:03   ;   Acc += B
00:03   02:02   Store   00:04   ;   C = Acc



                                ;Move B & C to A & B
00:04   02:01   Load    00:05   ;   Acc = B
00:05   02:00   Store   00:06   ;   A = ACC
00:06   02:02   Load    00:07   ;   Acc = C
00:07   02:01   Store   00:08   ;   B = Acc

                                ;Count++
00:08   02:03   Load    00:09   ;   Acc = Count
00:09   00:04   Inc     00:10   ;   Acc++
00:10   02:03   Store   00:11   ;   Count = Acc

00:11   Branch  Out     00:12   ;If Acc != 0
00:12   00:13   Load    00:00   ;   Goto 00:00
00:13   Halt    Out     00:00   ;Else HALT

02:00   DATA    0               ;A
02:01   DATA    1               ;B
02:02   DATA    0               ;C
02:03   DATA    -10             ;Count