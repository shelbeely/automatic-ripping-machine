# The Story of the Automatic Ripping Machine

*A narrative told by 2,750 commits, 101 contributors, and nearly a decade of open source collaboration.*

---

## The Spark (Summer 2016)

It started the way many great open source projects do — with a personal itch.

On July 24, 2016, **Benjamin Bryan** pushed an initial commit under the GitHub handle *ahnooie*. The project was a handful of shell scripts: detect an optical disc, figure out what it is, rip it with MakeMKV, transcode it with HandBrake. Simple. Practical. The kind of thing you hack together on a weekend because you're tired of manually ripping your DVD collection.

Within days, Benjamin added audio ripping with `abcde`, high-profile encoding, and a fix for udev killing long-running tasks — a frustration anyone who's wrestled with Linux disc automation knows too well. The early commits read like a builder's journal: terse, functional, one idea per line. *"eject after rip instead of transcode, filenames."* *"batch video transcode until system load is low."* *"fix for udev killing long running tasks."*

By September, the project had its first outside contributor. **Derek Christensen** arrived with a massive commit that added multi-drive support, a configuration file, per-disc logging, Pushbullet and IFTTT notifications, and automatic cleanup. It was the kind of contribution that transforms a personal script into a real tool. Benjamin merged it via Pull Request #1 on September 11, 2016, and just like that, ARM was a collaboration.

## Finding Its Legs (2016–2018)

The project's first year was a whirlwind of shell scripts and early community building. **muckngrind4** contributed MakeMKV backup methods and Emby library scanning. Benjamin kept polishing — UDF video detection, continuous integration, Python requirements. By late 2016, ARM had 20 pull requests merged and was handling DVDs, Blu-rays, and audio CDs.

Then came the pivot.

In mid-2017, Derek began moving the disc processing logic from shell scripts into Python. *"Move dvd processing to python,"* read the June 10, 2017 commit. Over the next several months, the rewrite took shape: identify.py replaced shell-based detection, notifications moved into a Python utility module, and the architecture shifted to something maintainable. By January 2018, Derek had rewritten identification for both Blu-ray and DVD, merged a web status interface contributed by **audioeng**, and updated everything to Python 3.

**v2.0.0** landed on July 14, 2018. Derek had added a Flask web UI framework, OMDB API integration for disc metadata, and database-backed job tracking. The shell script era was over. ARM was now a Python application with a web interface, and the year's 274 commits reflected the intensity of the transformation.

## The 1337-server Era (2020–2023)

After a quieter 2019 (just 45 commits — the calm after a major rewrite), the project's center of gravity shifted dramatically.

In November 2020, a contributor known as **1337-server** appeared. Their first day produced a torrent of commits: Debian install scripts, Apprise notification support, duplicate rip detection, MusicBrainz integration, dozens of bug fixes. It was as if someone had been stockpiling improvements and unleashed them all at once.

What followed was extraordinary. Over the next three years, 1337-server would become ARM's most prolific contributor by a wide margin — **959 commits**, more than double the next contributor. They touched every part of the system: the web UI got a complete overhaul with a new login page, database explorer, system information panel, and settings interface. Docker support arrived in March 2022 with automated builds and DockerHub publishing. MusicBrainz replaced the older audio identification. Desktop notifications appeared. The job detail page grew rich with transcoding stage indicators and progress tracking.

The numbers tell the story: 322 commits in 2020, 334 in 2021, a peak of **650 in 2022**, and 570 in 2023. The project had found its most dedicated steward.

But 1337-server wasn't alone. **wolfy** emerged as a key maintainer, contributing 479 commits focused on installation scripts, merge coordination, and release management. **Microtechno9000** added 236 commits — restructuring the codebase with proper blueprints, splitting authentication into its own module, fixing security issues flagged by SonarCloud, and contributing features like system drive management and version handling. **Mtech** handled configuration improvements and bug fixes with 121 contributions.

Together, these four formed the core team that carried ARM through its most productive years.

## Community and Craft (2022–2025)

By 2022, ARM had become a genuine community project. The Docker image made it accessible to a wider audience. Dependabot kept dependencies current (145 automated commits). GitHub Actions automated testing, image publishing, and version management (87 commits from github-actions[bot]).

The contributor list grew to span the globe: **Felix Nüsse**, **Johannes Ammon**, **Sylvain Tousignant**, **Johan Swetzén**, **Pasi Saarinen** — names suggesting a worldwide community of media enthusiasts. Over 70 unique individuals contributed at least one commit. Some left a single surgical fix; others returned again and again.

The project's maturity showed in its concerns. Early commits were about *making it work*. By 2023–2025, commits focused on *making it right*: dark mode fixes, Docker security (removing the privileged flag requirement), Raspberry Pi 4 compatibility, CD-R/CD-RW support, configurable paths replacing hard-coded ones, and Blu-ray main-feature ripping to avoid wasteful full-disc extraction.

Release tags trace the journey: from the early `v1.0.0` through `v2.0.0` (the Python rewrite), a long 2.x series spanning 100+ releases with meticulous patch versions, to `2.21.5` — the last release of the Python era, tagged on February 5, 2026, with a HandBrake preset fix contributed by **Luna**.

## The AI-First Rewrite (February 2026)

Then came the most radical transformation yet.

On February 12, 2026, a pull request titled "Port to Node.js" was merged — an entire rewrite of the application from Python/Flask to Node.js/Express, executed in 18 commits by **copilot-swe-agent[bot]** and merged by **Shelbee Johnson**. The new architecture didn't just change the language; it changed the philosophy. AI became a core requirement, not an optional feature. An OpenAI-compatible LLM now powers disc identification (parsing cryptic labels like `STAR_WARS_EP_IV_DISC1`), transcode optimization, error diagnosis, and media-library file naming.

The new stack introduced the Model Context Protocol (MCP), making ARM both a server — exposing its tools to external AI applications — and a client — connecting to external MCP tool servers for metadata lookup. Express 5, Knex with better-sqlite3, EJS templates, and a Jest test suite with 150+ tests replaced Flask, SQLAlchemy, Alembic, and Jinja2.

It was, in many ways, a full-circle moment. Just as Derek had rewritten the shell scripts in Python to make the project maintainable, and 1337-server had rebuilt the UI and infrastructure to make it usable, this latest rewrite reimagined what a disc ripping tool could be in an age of AI agents and tool-use protocols.

## What the Git Log Reveals

The story of ARM is the story of open source at its most human. A personal project that became a community effort. A weekend hack that evolved through **three complete architectural generations** — shell scripts to Python to AI-first Node.js. A contributor graph that peaked at 650 commits in a single year, driven by someone so prolific they chose the handle *1337-server*.

The 2,750 commits contain 675 bug fixes, 65 explicitly tagged features, and 321 merged pull requests. They span from a hot summer day in July 2016 when one developer got tired of manually ripping DVDs, to a February morning in 2026 when an AI agent rewrote the entire codebase.

Throughout it all, the core purpose never wavered: insert a disc, and ARM takes care of the rest. The how changed — shell, Python, Node.js, AI — but the why never did.

That's the story the git log tells.
