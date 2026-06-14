import { surahName } from "../config/constants.ts";

interface MastheadProps {
  surah: number;
}

/** Page header — brand, ornament, and the one-line tool description. */
export function Masthead({ surah }: MastheadProps) {
  return (
    <>
      <header className="masthead">
        <div className="brand">
          <span className="ornament" aria-hidden="true">
            ۞
          </span>
          <div className="brandText">
            <span className="kicker" aria-hidden="true">
              ﷽
            </span>
            <h1>Halaqa Reading Planner</h1>
            <span className="sub">Tafsir Ibn Kathir · {surahName(surah)}</span>
          </div>
        </div>
        <span className="wordmark" aria-hidden="true">
          حَلْقَة
        </span>
      </header>
      <p className="lede">
        Pick where to start and how much to cover, see the split, fine-tune, then copy the WhatsApp
        message.
      </p>
    </>
  );
}
