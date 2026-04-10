Act as a senior product architect, SaaS QA reviewer, UX auditor, UI reviewer, and technical systems analyst.

Audit my full marketing tool as a real working SaaS product.

This product allows marketers to:
- create projects
- enter project data
- calculate metrics
- build metric trees
- write brand story
- create content plans
- plan campaigns
- organize strategy and marketing workflows inside one system

Your task is to check the product end-to-end and verify whether everything is built correctly across:
- architecture
- workflows
- technical behavior
- buttons and interactions
- metrics and formulas
- navigation
- UX
- UI
- consistency
- visual system
- product logic

What to check:

1. Architecture
- Is the product structured correctly as one connected system?
- Are all modules logically connected?
- Are projects the correct top-level entity?
- Do all sections connect properly to project data, metrics, planning, and outputs?
- Is the architecture scalable and clean?

2. Workflow logic
- Can a marketer move through the product naturally?
- Are project setup, data input, metrics, brand story, content plan, campaigns, and outputs connected logically?
- Do sections support real marketing workflows?

3. Technical and functional logic
- Do all buttons work correctly?
- Do forms, inputs, dropdowns, tabs, filters, toggles, and selectors behave properly?
- Are there broken actions, dead ends, missing states, weak validations, or incomplete flows?
- Are loading, empty, success, and error states present where needed?

4. Metrics and formulas
- Are all metrics calculated correctly?
- Are formulas mathematically correct?
- Are metric trees logically structured?
- Do labels match actual calculations?
- Do outputs correctly reflect inputs?
- Is any formula broken, misleading, duplicated, or incomplete?

5. UX
- Is navigation clear?
- Does the user always understand where they are and what to do next?
- Is the workflow intuitive and practical for marketers?
- Does the system reduce chaos and improve productivity?

6. UI and visual consistency
- Check spacing, typography, buttons, forms, cards, colors, labels, icons, hierarchy, readability, alignment, consistency, clutter, overlap issues, and broken layouts.
- Check whether all screens look like parts of one system.

7. Consistency
- Check terminology
- section names
- button names
- metric names
- state names
- visual patterns
- interaction patterns
- output logic

8. Missing or weak parts
Find:
- missing modules
- missing states
- missing save/edit/update logic
- missing validations
- missing transitions
- weak structure
- weak connections between modules
- incomplete logic
- anything underdesigned or not production-ready

Rules:
- Be strict
- Be practical
- Do not stay abstract
- Treat the product like a release candidate
- Do not only describe issues
- Fix them

For every issue:
1. Identify it
2. Explain why it is a problem
3. Provide the correct fix
4. Improve the product directly
5. Add missing logic if needed
6. Redesign weak areas if needed

Output:
- architecture audit
- workflow audit
- technical audit
- metrics/formulas audit
- UX audit
- UI audit
- consistency audit
- missing parts
- fixed and improved final version

Final instruction:
Review the whole product end-to-end.
Check whether everything is architecturally correct, technically functional, logically connected, visually consistent, and useful for real marketers.
Then immediately fix, complete, rewrite, redesign, and improve all found bugs, gaps, broken buttons, wrong formulas, weak UX, visual inconsistencies, and underbuilt areas.