Client Finder — Ideal Frontend Product Description
1. Product purpose and frontend philosophy

Client Finder is not supposed to feel like a collection of disconnected screens. It should feel like one continuous workspace where a user can move from discovering businesses to deciding whether those businesses are worth contacting, then into saving, organizing, and emailing them. The frontend exists to make that workflow understandable, fast, and trustworthy.

At the product level, the user journey is:

Search → Relevancy → Verification → Clients → Outreach

That pipeline is not just a backend concept. It should be visible in the interface itself. The SRS also emphasizes a multi-step dashboard with filtering at each stage, persistent search history, AI-driven relevance scoring, live verification, exported client data, email generation and email analytics, all delivered through a responsive web interface with progressive feedback and notifications.

Core frontend principles

The ideal frontend should follow these rules:

The user should always know where they are in the workflow.

The user should always know what happened, what is still running, and what to do next.

Long-running background work must never make the interface feel frozen.

AI results must never feel magical or unexplained; they must feel inspectable.

High-value actions should be obvious: start search, run relevance, verify selected leads, save clients, generate email, approve/send.

The product should look like a serious B2B SaaS workspace, not a marketing template or a toy dashboard.

It should feel simpler and more guided than Apollo/ZoomInfo, while still being data-dense enough to support real decision-making. The SRS itself distinguishes the product by emphasizing real-time scraping, custom natural-language search contexts, live trust checks, and a simpler exporter-oriented step-by-step pipeline rather than heavyweight CRM complexity.

2. Overall frontend architecture

The frontend should consist of two clearly different experiences:

A. Public website

This is for first-time visitors, evaluators, and future customers.

B. Logged-in product workspace

This is for actual product usage after authentication.

These two should share the same brand language, but not the same interaction model.

The public website should be persuasive, clean, and product-revealing.

The logged-in workspace should be operational, dense, and action-oriented.

3. Public website experience

The landing website exists to explain the product, establish trust, and drive the user into signup, login, or demo.

What the public website should communicate

It should immediately tell a new visitor:

What Client Finder is

Who it is for

What problem it solves

Why it is better than manual prospecting or fragmented tools

What the workflow looks like

How quickly someone can get value

What action to take next

The SRS states the core pain clearly: exporters and B2B teams currently search manually across platforms, verify authenticity separately, and prepare emails separately, creating inefficiency, inconsistency, and risk. The platform’s value is integrating search, relevance evaluation, trust verification, and communication into a single system.

Public pages
3.1 Homepage

The homepage should contain:

A clean top navigation bar

A hero section with strong headline and short explanation

A product UI preview, not generic illustration

Social proof or trust strip

Features overview

“How it works” section

Pipeline section

Pricing preview

Final CTA

Footer

The homepage should visually sell the idea that this is a workflow product, not just a database. The preview on the right side of the hero should look like a simplified version of the actual app: search input, results, match scores, status badges, maybe a highlighted “verified” signal.

3.2 Features page

This can be separate or section-based, but should clearly explain:

Search businesses globally

Apply custom AI search context

Run AI relevance scoring

Perform real-time verification checks

Save shortlisted clients

Generate and manage outreach emails

Monitor email status and analytics

Admin monitoring and controls

Those map directly to the functional requirements and use cases in the SRS.

3.3 Pricing page

Even if billing is not fully implemented, the page should feel real. It should include:

Plans

Usage logic

Basic feature comparison

CTA to start

FAQ-style trust section

3.4 Sign in / Sign up entry points

These should be easy to reach from the header and repeated in CTAs.

4. Authentication experience

The SRS requires user registration and login with encrypted credentials and isolated user data environments. It also includes login/register as a core use case and notes secure session behavior.

Required auth pages
4.1 Login page

The login page should include:

Email

Password

Forgot password link

Submit button

Link to sign up

Error state for invalid credentials

Loading state during sign-in

Clear redirect into dashboard on success

4.2 Signup page

The signup page should include:

Full name

Work email

Password

Confirm password

Workspace or company name

Terms agreement checkbox

Submit button

Link to login

Validation messaging

4.3 Forgot password

The page should include:

Email field

Submit/reset button

Confirmation state after request

4.4 Email verification

Even if simple, there should be a verification state:

“Check your email”

Resend verification

Change email

Return to login

Auth interaction philosophy

Auth screens should feel professional and trustworthy. They should not talk about migration phases, placeholders, or backend limitations. They should feel like a real product boundary into the workspace.

5. Logged-in application shell

Once the user logs in, they should not feel like they are entering isolated pages. They should feel like they are entering a workspace.

5.1 Core shell layout

The shell should have:

Left sidebar navigation

Top bar

Main content area

Optional right-side drawer or modal system

Global toast/notification layer

5.2 Sidebar contents

The sidebar should group navigation into logical sections.

Main workflow

Dashboard

Search Businesses

Clients

Contacts

Activity

Email Workspace

Contexts

Account/system

Billing

Settings

Admin (role-based)

5.3 Top bar

The top bar should show:

Current page context

Workspace name

Search/global command area if needed

Notification bell

User avatar/menu

Fast actions if needed

5.4 Global elements

Across the entire app there should be:

Toasts for success/error

Background job indicators

Loading skeletons

Empty state design language

Error banners

Retry affordances

Consistent page header pattern

Consistent stat card pattern

Consistent data list/card pattern

6. Dashboard page

The SRS includes dashboard analytics and a multi-step pipeline dashboard where users can move leads through Search, Relevancy, Verification, and Shortlisting. It also includes dashboard analytics as a use case and explicitly says the dashboard should load with available data even if some metrics fail.

The dashboard is the home screen after login. It is not just analytics; it is the user’s operational command center.

6.1 Dashboard purpose

The page should answer:

What is happening in my pipeline?

What changed recently?

What should I do next?

Where is work blocked?

What is worth my attention right now?

6.2 What appears on the dashboard
A. Header

Page title: Dashboard

Short explanatory subtitle

Primary CTA: Start Search / New Search

Optional secondary action: View Activity

B. KPI card row

Core metrics should include:

Total Searches

Leads Found

Relevant Leads

Verified Leads

Saved Clients

Emails Sent / Active Outreach

Cards should feel tied to product reality, not generic vanity metrics.

C. Pipeline overview block

A visible pipeline visualization:

Search

Relevancy

Verification

Clients

Outreach

Each stage should show count and status. This is one of the most important blocks in the product.

D. Recent searches

A list of recent search sessions with:

Query

Context used

Time

Number of results

Status

Button to reopen

The SRS explicitly requires search history persistence so users can reload any past pipeline without repeating the process.

E. Recent activity

A timeline feed with:

Search started

Relevance run completed

Verification finished

Client saved

Email draft generated

Email sent

F. Charts

Useful charts include:

Funnel conversion chart

Top industries

Verification distribution

Outreach status

Charts should not dominate; the dashboard is first operational, then analytical.

G. Next actions

A block that helps the user proceed:

“3 searches need review”

“12 relevant leads ready for verification”

“5 verified clients ready for outreach”

6.3 Dashboard interaction

The dashboard should be highly actionable:

clicking cards drills into relevant pages

clicking recent searches reopens pipeline state

clicking next actions takes user directly to filtered views

7. Search Businesses page

This is the heart of the system. The SRS defines client discovery, real-time data collection, data cleaning, AI relevancy scoring, and review/select leads as core requirements and use cases.

This page should feel like a single operational workspace, not several disconnected pages.

7.1 Search page purpose

The user comes here to:

define what they want

run discovery

review discovered businesses

trigger AI relevance

trigger verification

decide what to keep

7.2 Main sections on the search page
A. Page header

Title: Search Businesses

Subtitle describing the workflow

CTA or helper hint

B. Search control bar

The user can define:

Keywords / business type

Location / geography

Optional filters

Context selector

Search button

This should also show selected search context clearly because the SRS makes search contexts central to how relevance is judged.

C. Search contexts panel

There should be a visible way to:

choose existing context

create new context

preview current context

know which context is active

D. Search session/history sidebar or section

This should show:

previous searches

last run time

results count

quick reload

7.3 Search results section

Each result should present enough information for first-level screening:

Business name

Category / industry

Address/location

Website

Phone/email if available

Status badges

Select checkbox

Quick actions

7.4 Search result actions

Per-item or batch actions:

Select

Select all

Run Relevancy

Add to clients

Ignore / dismiss

View details

7.5 Relevancy processing state

When relevance is triggered, the page should not navigate away unless that is a design choice. It should show a dynamic state:

progress indicator

items being processed

completed items

failed items

partial results

The SRS says partial results should be retained if analysis stops and low confidence results should be marked.

7.6 Relevancy results presentation

For each lead, once processed:

Relevancy score

Decision badge (passed / not relevant / low confidence)

Short AI reasoning

Controls:

save to clients

send to verification

ignore

inspect details

7.7 Verification state

After leads are selected for verification, the same workspace should support verification progress or a clearly linked next-step page.

Verification should show:

in progress

complete

partial verification

failed

warning state

Because the SRS explicitly says verification may take time and may return partial results if lead data is incomplete.

7.8 Verification results presentation

Each lead should show:

Verification score

Trust status

SSL/domain/legal signals

Website presence

Social presence

Policy detection

Contact validity

Risk or warning summary

7.9 Search page UX philosophy

This page should support the full “discover → score → verify → decide” flow with as few disorienting transitions as possible.

8. Relevancy page or relevance state view

If relevance is split into a dedicated page, it should still feel connected to Search.

Purpose

To let the user inspect AI scoring before deciding which businesses move forward.

What appears

Header with clear relation to search session

Summary:

processed count

passed count

failed count

low-confidence count

Filter chips:

all

passed

failed

pending

Lead list/cards with score and explanation

Batch action: send selected to verification

User interaction

The user should:

filter

inspect

compare

select

continue

9. Verification page or verification state view

The SRS includes run deep verification, run trust scanner, and view verification details as dedicated use cases.

Purpose

To show whether a lead is trustworthy enough to contact.

What appears

Header and stage explanation

Summary cards:

verified

partial

failed

pending

Lead list with stronger trust-centric presentation

Verification evidence

Batch action: save selected to clients

Verification details shown on each item

Verification score

Trust bucket

Website live / dead

SSL present

Domain age if available

Privacy policy

Terms page

Social links

Contact evidence

Flags or warnings

UX emphasis

This page should feel less like “scoring” and more like “risk and trust review.”

10. Clients page

The SRS requires selected verified clients to be saved into a dedicated dashboard view for future management and interaction.

Purpose

This is the managed shortlist — the user’s working lead database inside the platform.

What appears
A. Header

Title: Clients

Subtitle

Export CTA

B. Filter bar

Search by name/company

Filter by verification

Filter by relevance

Filter by stage

Possibly filter by saved date or activity

C. Client list

This can be hybrid table/card depending on density, but should include:

Name

Verification status

Relevancy score

Contact availability

Last activity

Saved date

Quick actions

D. Bulk actions

Export

Re-run relevance

Re-run verification

Remove from clients

Generate email

What each client record should support

Open business details

Open outreach

View history

Export selected

Client management philosophy

This page should feel like a lightweight CRM for shortlisted targets, not a generic leads table.

11. Business Details page

This is one of the most important pages in the whole product because this is where the user decides if the system is intelligent and trustworthy.

The SRS includes “View Verification Details” as a use case and expects verification data to be clearly presented.

Purpose

To let the user deeply inspect a single business.

Layout philosophy

This page should not be one long, messy scroll. It should be organized into clear sections or tabs.

Recommended top structure

At the top:

Business name

Status badges

Score summary

Key quick actions:

Save/remove client

Generate email

Go back

Re-run verification

Main detail areas
11.1 Overview tab

Shows:

Core identity

Category

Location

Website

Short summary

Contact info

11.2 AI Relevance tab

Shows:

Relevance score

Reasoning summary

Search context used

Why it matched

Why it may be weak

Confidence notes

11.3 Verification tab

Shows:

Verification score

Trust signals

Risks

Evidence summary

Website credibility checks

11.4 Contacts tab

Shows:

Emails

Phones

Contact names if available

Social/contact channels

11.5 Activity / History tab

Shows:

when searched

when scored

when verified

when saved

when emailed

11.6 Outreach tab

Shows:

draft state

sent emails

reply state

next actions

User interaction

This page should allow:

reviewing evidence

deciding trustworthiness

moving to outreach

going back to the right pipeline step

12. Contacts page

The SRS mentions the actor using contact and email-driven workflows, and the platform needs extracted business and contact information for evaluation and outreach.

Purpose

This page centralizes contact-level information across searched and saved businesses.

What appears

Contacts table/list

Name or contact placeholder

Associated business

Email(s)

Phone(s)

Status

Source

Sync state

Actions

search contacts

filter contacts

open parent business

send to email workspace

export

13. Email Workspace

The SRS explicitly requires AI-assisted email generation, approve/send, and view email status with sent/opened/bounced analytics.

Purpose

This page is where shortlisted clients become outreach opportunities.

Structure
A. Header

Title: Email Workspace

Subtitle

CTA to create campaign or generate draft

B. Mode selection

Two clear entry modes:

Use existing clients

Use selected leads/new prospects

C. Recipient list / queue

List of recipients with:

Name/company

email

verification/relevance state

outreach status

D. Draft generation panel

The system should take:

contact info

business info

relevance reasoning

verification results

And generate:

subject line

email body

personalized opening

editable draft

The SRS requires custom email generation through AI and approval/send through the email server.

E. Draft editor

The user should be able to:

edit subject

edit body

approve

send

save draft

F. Campaign or sending state

Show:

pending

drafted

approved

sent

failed

Analytics block

Should display:

emails drafted

emails sent

delivered

opened

bounced

replied

response rate

This aligns with the email status and analytics requirements.

14. Activity page

The SRS requires monitoring searches, email performance, and system activity patterns. It also includes “View Dashboard Analytics” and admin monitoring of system usage.

Purpose

This is the timeline and operational memory of the workspace.

What appears

A chronological feed of:

searches run

relevance jobs

verification jobs

clients saved

emails generated

emails sent

replies received

exports

Filters

by date

by action type

by entity

by status

Interaction

The activity page should not just show text logs. Every item should let the user drill back into the underlying object.

15. Billing page

The SRS includes export constraints, email sending limits, and the platform being web-only, plus a billing need if the product becomes SaaS. Even if not fully operational now, the frontend should support this area cleanly.

Purpose

Account and subscription management.

What appears

Current plan

Usage summary

Billing cycle

Payment history

Invoice list

Upgrade/downgrade actions

Helpful usage metrics

searches this month

verified leads processed

emails sent

seats/users if relevant

16. Settings page

The SRS includes manage profile as a use case and mentions user preferences and secure profile handling.

Purpose

Personal and workspace configuration.

Recommended sections
Profile

Name

Email

Password change

Profile photo

Preferences

Theme

Notification settings

Default dashboard behavior

Workspace

Workspace name

Organization info

Team-level defaults

Search defaults

default context

default filters

default export preferences

Email settings

sender identity

signature

sending preferences

17. Admin panel

The SRS explicitly requires an admin oversight dashboard and includes configure AI thresholds, manage API keys, and manage users as admin use cases.

Purpose

Operational control plane for platform administration.

Main admin sections
17.1 Admin dashboard

Shows:

active users

searches today

emails today

system health

API health

queue health

17.2 User management

list users

roles

status

create/update/remove users

17.3 API key management

masked keys

rotate/revoke

service status

last checked

17.4 AI threshold configuration

relevance threshold

verification thresholds

confidence cutoffs

trust/risk classification settings

The SRS notes threshold configuration, secure API key handling, and role-based access as explicit admin concerns.

17.5 Audit/monitoring

recent admin actions

config changes

system incidents

18. Notifications and global feedback

The SRS says the interface should include progressive feedback and notifications, and that the frontend should remain responsive while background jobs run asynchronously.

So globally, the frontend should include:

toast notifications

success banners

warning banners

processing notices

completion alerts

retry prompts

skeleton loading patterns

Important events that should trigger feedback:

search started

relevance completed

verification failed

client saved

export completed

email generated

email sent

19. Real-time and async behavior

A major non-functional requirement is that scraping and AI evaluation happen in the background without blocking the UI, while the interface remains interactive and fault tolerant.

The frontend should therefore support:

progressive loading

optimistic feedback where safe

partial results

job progress

recoverable errors

refresh/retry states

clear “still processing” messaging

No page should ever feel frozen because an agent is running.

20. Data states every major page must support

Every important page should be intentionally designed for these states:

First-time empty

Loading

Partial data

Completed data

Error

Retry

No results found

Filtered-to-zero state

This is especially critical for:

Dashboard

Search

Relevancy

Verification

Clients

Email Workspace

Activity

Admin

21. Interaction model by user role

The SRS identifies at least two main human roles: User/Exporter and Admin.

User/Exporter

Can:

register/login

configure search context

search businesses

review/select leads

run relevance

run verification

manage saved clients

export data

generate/approve/send emails

view email status

manage profile

Admin

Can:

manage users

manage API keys

configure AI thresholds

monitor platform health and usage

This should affect both navigation visibility and action visibility.

22. Visual style and design language

The frontend should look like a modern SaaS platform:

dark-mode-friendly

crisp typography

restrained use of color

clear emphasis on status colors

soft borders and layered surfaces

serious, operational tone

data-heavy but readable

no visual clutter

Reference feel:

Apollo / ZoomInfo for data density

Stripe / Vercel for polish and spacing

Notion/Linear for clarity and usability

23. The most important behavioral truth of the product

If there is one thing the frontend must communicate better than anything else, it is this:

Client Finder is a guided decision system.

It helps the user answer:

Which businesses should I look at?

Which ones actually fit my business?

Which ones can I trust?

Which ones should I save?

Which ones should I contact?

What happened after I contacted them?

That is the real product.

24. Final condensed product vision

The ideal Client Finder frontend is a single, web-based SaaS workspace that starts with a polished public website, moves into secure authentication, and then gives users a guided operational product for discovering businesses, evaluating them with AI, verifying their credibility, saving them into a manageable client pipeline, generating and sending outreach emails, and monitoring performance through dashboards, history, and admin oversight. That direction is fully consistent with the project’s objective, system functions, functional requirements, and use cases in the SRS.