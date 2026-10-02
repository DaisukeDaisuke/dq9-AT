# Follow-up measured checkpoint — 2026-10-02 14:55 UTC

V3 and V4 remain unadopted. V4 removed the coarse gate for existing small components, but kept the missed enemy and increased H5 false positives; the fixed mean threshold was not reduced to fit this case.

The existing Work1 B0 D1 classifier gate (score0.45, margin0.05) was applied equally to B0, frozen V2 and V3 proposals, using identical original64-reference CLS vectors and opaque ROI preprocessing. All122 registered frames were processed with original eligibility. Filtering considers at most each method's original8 boxes; it does not refill from lower-ranked boxes. This is a known-regression diagnostic, not fresh validation or a production integration.

At displayed top2, IoU0.5:
- T1190: B0+CLS TP14/22 FP7; V2+CLS TP8/22 FP0; V3+CLS TP16/22 FP2.
- H4: B0/V2 TP1/3 FP0; V3 TP2/3 FP0.
- D1: all TP2/4 FP0; D2 all TP2/5, B0 FP2 and V2/V3 FP0.
- H5 is now observed regression: all TP1/2, B0 FP1 and V2/V3 FP0. Do not call this added gate evaluation fresh H5 validation.

The actual detector's ROM reference preparation and browser path have not yet been connected to this additional classifier verification. That is the next bounded check; no recognition success is claimed from model ranking alone. This comparison measures the retained body boxes.

AT log preview: actual cloud Chrome restored the31,623,295-byte session with BOOT0/conditional33; the6413-character log expanded and collapsed, and an invalid projection was rejected with the prior state intact. Later save/download attempt found an expired tab, so complete file download remains unverified, not a demonstrated app failure.

The saved Work8 controller0x0236fdb8 has placement mode0. Source-only sensitivity with flags0/1 and identical frozen clocks produced the same six ordered draws and all invocations. Native setter PC/time and future mode stability remain unproven; the existing mismatch is retained.

Private recovery inventory now points to a verified small Library checkpoint containing sampling, original labels, raw predictions and diagnostic scripts, without ROM/SAV/RAM/video/images/model weights. Production source and runtime are unchanged in this checkpoint.
