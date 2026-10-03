# Native-resolution recognition candidate V6: rejected for adoption

Preserved V5 and fixed inputs. Changes are small-component fine fallback using the existing V4 size rule, opaque fine crops, and final CLS crops from the same native256x192 sampled field used by position inference. Original numeric confidence thresholds unchanged.

Known H5 now locates both existing enemies with no retained false box (previous1/2). On the small gray enemy, native opaque CLS score0.466686 passes the unchanged0.45 gate while original-resolution opaque CLS0.412316 failed. These are known-frame diagnoses, not fresh validation.

Broader fixed regression prevents adoption: top2/IoU0.5 D2 TP2→1, H4 TP2→1, T1190 TP16→13; H false boxes0→2 and T320 party-overlap false boxes0→2. D1 andH2 unchanged. No production source or deployed candidate was replaced. V6_DECISION.json andV6_METRICS.json preserve complete results and failure details.

Do not solve these counterexamples with per-frame exceptions or threshold tuning. The final classifier still confuses body-like party/background shapes with the four ROM classes. This supports the need for a more discriminative recognition approach rather than claiming native resampling alone fixes detection.
