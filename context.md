# Project context

Domain background for anyone (human or AI) working on this repository. Pair this
with [`AGENTS.md`](AGENTS.md) (how to work). The architecture rationale lives in
the sibling project's ADRs (`cronologia/fsp` → `docs/adrs/`).

## The subject: Teologia da Libertação

**Teologia da Libertação** (Liberation Theology) is the Latin American
theological movement — more precisely, a *family of theologies* — that
interprets Christian faith from the experience of the poor and oppressed.

- **Emerged:** 1968–1971, from the reception of the Second Vatican Council
  (1962–65) at the **Medellín conference** of the Latin American bishops
  (CELAM II, August–September 1968) to **Gustavo Gutiérrez**'s foundational
  book *Teología de la liberación. Perspectivas* (Lima, 1971). Gutiérrez had
  coined the reframing at a July 1968 talk in Chimbote, Peru; the Brazilian
  Protestant Rubem Alves wrote a parallel pioneer text at Princeton (1968–69).
- **Core theme:** the **preferential option for the poor**, consolidated at
  Medellín (1968) and Puebla (1979).
- **Vatican reception:** two CDF instructions under Cardinal Ratzinger —
  *Libertatis Nuntius* (1984), criticizing the uncritical borrowing of Marxist
  analysis, and *Libertatis Conscientia* (1986), developing a positive theology
  of liberation. Individual outcomes differed sharply: Leonardo Boff was
  silenced (1985) and later left the priesthood; Jon Sobrino received a
  notification without silencing (2006/07); Gutiérrez was scrutinized but never
  sanctioned.
- **Key martyrs and symbols:** Óscar Romero (assassinated 1980, canonized
  2018); the six Jesuits of the UCA massacre, including Ignacio Ellacuría
  (1989); Camilo Torres (d. 1966) as a *precursor* symbol.
- **Later reception:** Pope Francis's gestures (receiving Gutiérrez in 2013,
  canonizing Romero, restoring Ernesto Cardenal in 2019) are read by some as
  rehabilitation and by others as continuity with the distinct Argentine
  *teología del pueblo* — both readings are attributed, not asserted. Gutiérrez
  died in October 2024; debate about the stance of Leo XIV (elected 2025, with
  decades in Peru) is likewise attributed to the sources conducting it.

## Project goal

Produce an **open, source-referenced chronology** as a static website:

- Every key event from the 1960s to the present, cited to public sources.
- The key figures of the movement **and** its institutional interlocutors
  (popes, CDF, CELAM leadership).
- Related organizations and currents kept distinct (CELAM, CEBs, Christians
  for Socialism, ISAL, derived theologies).
- Both the movement's **own texts** and **critical** analyses, so the same
  event is describable from more than one side.

The project values **verifiability and neutrality** over completeness. It
serves readers across the political and theological spectrum, so it must
describe rather than advocate, and flag what is uncertain: contested claims
are **attributed to their authors**, never asserted in the site's own voice.

## Important disambiguations

- **A current, not an organization.** Liberation Theology has no founding
  charter, headquarters, or membership roster. Never present figures as
  "members"; anchor entries in specific books, conferences and persons.
- **1984 ≠ blanket condemnation.** *Libertatis Nuntius* criticizes "certain
  aspects"; *Libertatis Conscientia* (1986) is notably more positive.
  Gutiérrez maintained "the Vatican never condemned the theology of
  liberation" — cite as his claim.
- **Different figures, different outcomes** (Boff / Sobrino / Gutiérrez — see
  above). Avoid the flattening phrase "the Vatican condemned liberation
  theology."
- **Romero and Camilo Torres caveats.** Romero was canonized as a martyr, not
  "as a liberation theologian", and his relationship to the movement is
  debated. Torres predates the movement and chose armed struggle, which its
  main theologians did not advocate.
- **Teología del pueblo ≠ liberation theology.** The Argentine current that
  formed Bergoglio is related but distinct (non-Marxist, culture-centered);
  keep the labels apart when describing Francis.
- **The PT / Foro de São Paulo link is an attributed claim.** Claims that CEB
  networks fed Brazil's Workers' Party and that Frei Betto brokered the
  PT–Cuba relationship appear chiefly in critical literature and biographies;
  the sibling `cronologia/fsp` project documents this connection under the
  same attribute-don't-assert discipline.

## Glossary

- **CELAM** — Consejo Episcopal Latinoamericano e Caribeño (founded 1955);
  its general conferences (Medellín 1968, Puebla 1979, Santo Domingo 1992,
  Aparecida 2007) frame the movement's history.
- **CEBs** — *comunidades eclesiais de base*, grassroots church base
  communities, strongest in Brazil; numeric estimates vary widely — report
  ranges with attribution.
- **CDF/DDF** — the Vatican's doctrinal congregation (now dicastery), author
  of the 1984/1986 instructions and the Boff/Sobrino notifications.
- **Preferential option for the poor** — the movement's central formula,
  adopted in CELAM documents.
- **Praxis** — the movement's methodological keyword: theology as critical
  reflection on practice.

## Primary / key sources

- **The movement's texts:** Gutiérrez (1971), Boff & Boff *Introducing
  Liberation Theology* (1986), Sobrino's christology, Segundo's *The
  Liberation of Theology* (1975).
- **The Holy See:** `vatican.va` — *Populorum Progressio* (1967), *Libertatis
  Nuntius* (1984), Boff Notification (1985), *Libertatis Conscientia* (1986),
  Sobrino Notification (2006), John Paul II's Puebla address (1979), Benedict
  XVI's Aparecida address (2007), Leo XIV's *Dilexi te* (2025).
- **CELAM:** conference documents (Medellín, Puebla PDFs at `celam.org`).
- **Cross-spectrum:** Wikipedia (EN/PT), Britannica, academic journals,
  obituaries (Gutiérrez 2024), and critical analyses (e.g. Acton Institute) —
  labeled by perspective where relevant.

All cited sources live in `data/chronology.json` → `references[]`. The Wayback
archiving pipeline (as in `cronologia/fsp`) is planned — see GitHub issues.
