# First Pass 002A — Children's Story Challenge / Topic Discovery

## Status

IMPLEMENTED — exact-head Forge CI required before merge.

## Coordination

- First-pass owner: ChatGPT co-chief engineer.
- Base: 001Z lossless structured book versions.
- Android backup work remains merged trunk truth and is not modified by this block.
- Branch: `first-pass/002a-childrens-story-topic-discovery`.

## Author capability

Forge can now answer typed or dictated requests such as:

`Compile a list of up to 100 common children's issues and struggles for my Heartwood Jungle story series, including friendship and feeling safe.`

The command is recognized inside the existing Forge Command Center and dashboard command surface. It does not require a configured AI provider because it is backed by a curated source-informed catalog, making the capability deterministic, fast and available offline with the Studio shell.

## Catalog

`public/children-story-topics.json` contains exactly 100 unique story-development topics across ten domains:

1. Friendship & Belonging
2. Emotions & Self-Regulation
3. Safety, Trust & Boundaries
4. Family & Home Changes
5. School & Learning
6. Identity, Self-Esteem & Difference
7. Bullying, Conflict & Fairness
8. Grief, Health & Change
9. Independence & Responsibility
10. Empathy, Resilience & Community

Each domain includes gentle framing guidance and source identifiers. The catalog explicitly states that it is an ideation tool, not a diagnostic system, and does not label an individual child.

## Research applied

The topic domains and framing were checked against current child-development and child-support guidance from:

- CDC child development: https://www.cdc.gov/child-development/about/index.html
- CDC classroom social dynamics: https://www.cdc.gov/classroom-management/approaches/classroom-social-dynamics.html
- CDC bullying: https://www.cdc.gov/youth-violence/about/about-bullying.html
- American Academy of Pediatrics / HealthyChildren childhood fears: https://www.healthychildren.org/English/health-issues/conditions/emotional-problems/Pages/Understanding-Childhood-Fears-and-Anxieties.aspx
- AAP divorce/separation guidance: https://www.healthychildren.org/English/family-life/family-dynamics/types-of-families/Pages/Adjusting-to-Divorce.aspx
- AAP grief guidance: https://www.healthychildren.org/English/healthy-living/emotional-wellness/Building-Resilience/Pages/How-Children-Understand-Death-What-You-Should-Say.aspx
- AAP stressful-experience guidance: https://www.healthychildren.org/English/healthy-living/emotional-wellness/Building-Resilience/Pages/stressful-experiences-how-to-help-your-child-heal.aspx
- UNICEF bullying guidance: https://www.unicef.org/lac/en/parenting-lac/security-protection/how-talk-your-children-about-bullying

These sources inform broad story-development domains; Forge does not claim that the catalog is a clinical classification or a substitute for professional care.

## Heartwood framing

Heartwood requests receive additional guidance to turn a challenge into a gentle animal-centered conflict, preserve the child's dignity, avoid blame, include supportive relationships, and move toward realistic safety, belonging, understanding, repair or resilience rather than an instant cure.

## Verification

- static regression checks exact catalog size/uniqueness, source references, framing and provider independence;
- real Chromium acceptance executes the 100-topic Heartwood request with all AI providers disabled;
- acceptance verifies the requested-count cap and a seven-topic request;
- the same harness uses a 390×844 touch viewport and checks horizontal overflow.

## Next build

Continue forward through live durable book-version management, publishing metadata/readiness, positioning and promotion workflows.
