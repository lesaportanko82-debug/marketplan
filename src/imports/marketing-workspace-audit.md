Act as a senior product architect, SaaS systems reviewer, QA analyst, UX auditor, UI reviewer, marketing workflow expert, and technical product analyst.

Your task is to perform a full end-to-end audit of my marketing tool.

This product is a complex marketing workspace where a marketer can:
- create and manage projects
- input project data
- calculate metrics
- build metric trees
- write brand story
- create content plans
- work with marketing strategy elements
- manage campaigns
- structure marketing information
- use different planning and analytical tools inside one ecosystem

You must review the product as a real SaaS system, not just as a set of screens.

Your goal is to verify whether the product is:
- architecturally correct
- technically consistent
- logically connected
- functionally complete
- visually consistent
- usable in real work
- scalable as a product system

Audit the product across all levels:
- information architecture
- product architecture
- workflows
- technical logic
- button behavior
- navigation
- calculations
- formulas
- metrics
- UX
- UI
- consistency
- visual system
- data flows
- empty / loading / error / success states
- backend-dependent logic if implied by the product structure

What to validate:

1. Product architecture
Check whether the whole system is built correctly as a unified product.
Validate:
- whether all modules are logically connected
- whether the structure of the tool matches real marketer workflows
- whether there is a clear hierarchy between projects, sections, tools, and outputs
- whether the system is modular and scalable
- whether the product feels like one ecosystem instead of disconnected features
- whether the information architecture is clear and practical
- whether key entities are connected correctly

2. Workflow logic
Check whether the marketer can realistically move through the product without friction.
Validate:
- project creation flow
- project setup flow
- data input flow
- metrics flow
- planning flow
- brand story flow
- content plan flow
- campaign logic
- reporting logic
- transitions between modules
- whether outputs from one section can logically feed another section
- whether the product reflects real marketing workflows, not just theoretical blocks

3. Technical and functional logic
Check whether all technical interactions are correct.
Validate:
- whether all buttons work logically
- whether buttons have correct actions
- whether there are broken actions
- whether there are dead ends
- whether all forms work correctly
- whether all interactive elements behave consistently
- whether filters, dropdowns, tabs, toggles, selectors, and inputs make sense
- whether validation is correct
- whether empty states exist where needed
- whether loading states exist where needed
- whether success and error states are handled properly
- whether data dependencies are clear
- whether there are incomplete or missing states
- whether there are broken or inconsistent user flows

4. Metrics, formulas, and calculations
Check all metrics, calculations, formulas, score logic, and analytical outputs.

Validate:
- whether all metrics are calculated correctly
- whether formulas are mathematically correct
- whether variables are consistent
- whether labels of metrics match what is actually calculated
- whether metric trees are logically structured
- whether dependencies between metrics are correct
- whether outputs reflect input values correctly
- whether formulas are displayed correctly
- whether any calculations are duplicated, broken, misleading, or incomplete
- whether calculations align with real marketing logic
- whether data summaries and outputs make sense

If any formula, metric, or calculation is wrong, fix it.

5. Data model and product logic
Check whether the internal structure of the product is logically sound.

Validate:
- whether projects are the correct top-level entity
- whether all modules attach to projects correctly
- whether project data, metrics, campaigns, brand story, and content plan are connected correctly
- whether outputs can be saved, edited, reused, and updated logically
- whether entity ownership is clear
- whether the product architecture supports future scaling

6. UX audit
Check whether the product is actually convenient for a marketer.

Validate:
- whether navigation is clear
- whether the user always understands where they are
- whether the next step is obvious
- whether complex sections are understandable
- whether the workflow is intuitive
- whether the user can move between strategy, analytics, planning, and execution without confusion
- whether the interface reduces chaos instead of creating it
- whether the system supports productivity and focus

7. UI and visual audit
Check whether the interface is visually consistent and professionally built.

Validate:
- consistency of spacing
- hierarchy
- typography
- cards
- buttons
- forms
- colors
- labels
- icons
- alignment
- readability
- density of information
- visual emphasis
- section consistency
- whether screens look like parts of one system
- whether the design feels clean and trustworthy
- whether there are visual bugs, overlap issues, broken layouts, weak hierarchy, clutter, or inconsistency

8. Consistency audit
Check consistency across the whole product:
- naming of sections
- naming of buttons
- naming of actions
- terminology
- metric naming
- module naming
- state naming
- style of labels
- logic of outputs
- interaction patterns
- visual patterns
- behavior patterns

9. Marketing-specific logic
Check whether the product is actually useful for real marketing work.

Validate:
- whether project setup supports real marketing planning
- whether metric logic reflects actual marketing analysis
- whether brand story creation is placed logically in the workflow
- whether content planning is connected to strategy
- whether campaign planning connects to metrics
- whether reporting logic is useful
- whether the product supports real decision-making
- whether modules are practical, not decorative

10. Missing parts and underdesigned areas
Detect:
- missing modules
- missing states
- missing technical logic
- missing validations
- missing transitions
- missing helpful summaries
- missing save/edit/update logic
- missing role logic if relevant
- weak architecture
- weak connections between modules
- anything that feels incomplete or underbuilt

What to do when issues are found:

For every issue:
1. Identify the issue clearly
2. Explain why it is a problem
3. Provide the correct version or fix
4. Improve the structure, logic, UX, or UI where needed
5. If something is missing, add it
6. If something is weak, redesign it
7. If something is inconsistent, unify it
8. If something is broken, repair it

Do not only comment on issues.
Actively correct, complete, rewrite, redesign, or extend the product wherever necessary.

Expected output:
1. Overall architecture review
2. Product structure audit
3. Workflow audit
4. Technical / functional audit
5. Metrics and formulas audit
6. UX audit
7. UI / visual audit
8. Consistency audit
9. Missing parts and risks
10. Fixed and improved target version
11. Final list of corrections and additions

Important behavior rules:
- Be strict
- Be practical
- Be detailed
- Do not stay abstract
- Think like a real SaaS architect and release QA reviewer
- Treat the product as if it is preparing for real launch
- Prioritize system integrity, clarity, marketer usability, calculation accuracy, and visual consistency

Final instruction:
Review the entire product end-to-end.
Check whether everything is architecturally correct, technically functional, logically connected, visually consistent, and useful for real marketers.
Then immediately fix, complete, rewrite, redesign, and improve all found bugs, gaps, errors, inconsistencies, weak points, missing logic, broken calculations, broken buttons, UX issues, visual issues, and underbuilt areas until the product becomes a stronger and more production-ready system.