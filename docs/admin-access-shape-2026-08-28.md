# The access panel's shape — what the tabs should be

Written 2026-08-28, after the observation that "роли и аккаунты сильно
пересекаются и вероятно могут быть слиты, билдер тоже частично покрывается
в ролях".

That observation is correct, and the overlap is measurable rather than a matter
of taste. This note says what the four tabs actually are, what the established
answer to this shape is, and what to do about it.

## 1. What the four tabs are today

| Tab | Source of truth | One row is | Writes |
|---|---|---|---|
| Учні | `lms_enrollments` grouped by account | a **person** with ≥1 course | grant, revoke, block, deadline |
| Акаунти | `platform_users` | a **person** | grant a course, set role |
| Ролі | `user_roles`, elevated only | a **person** | set role |
| Білдер | `lms_courses` | a **course** | set author, review |

Three of the four are the same entity. Not "related" — the same row, keyed on
the same `auth_user_id`, rendered from three list endpoints into three row
types:

```
RoleRow    = authUserId, email, fullName, avatarUrl, role, lastSignInAt,
             enrollments  + updatedAt, ownedCourses
AccountRow = authUserId, email, fullName, avatarUrl, role, lastSignInAt,
             enrollments  + provider, purchases
```

`RoleRow` is `AccountRow` with two extra counts. Учні is `AccountRow` filtered
to `enrollments > 0` with the enrollments expanded.

So the panel has **one list of people, presented three times**, and **one list of
courses**, presented on the people page — while a courses page (`/admin/catalog`,
tabs Publication and Pricing) exists next door.

## 2. What the established answer is

The rule the sources agree on is about *what a tab is for*:

- **NN/g, "Filters vs. Facets"** — tabs separate by the **type of content**
  (recipes / photos / cookbooks); facets narrow **within one type** along
  dimensions. A tab is a different kind of thing; a facet is a subset of the
  same kind.
- **GitHub organizations** — one member list with a **role dropdown**, not a tab
  per role. GitHub does use tabs in the same settings area — for **Users vs
  Teams**, which are genuinely different entities.

Stated as one line: **tabs split by entity, filters split by attribute.**

Against that rule:

- Ролі is `role != user` — an **attribute** of a person → should be a filter.
- Учні is `enrollments > 0` — an **attribute** of a person → should be a filter.
- Акаунти is the unfiltered list → the **base**.
- Білдер is courses → a **different entity**, so a tab is legitimate; but there
  is already a page whose entity is courses.

## 3. Where this lands

**Access = people. Catalog = courses.**

```
/admin/access    one list of PEOPLE
                 facets: role (all / with a role / coach / support / admin)
                          access (any / holds a course / none)
                          activity
                 row expands to: their courses (deadline, revoke, block),
                                 their role, the courses they own
                 one button: grant access (the dialog)

/admin/catalog   one list of COURSES
                 tabs: publication · pricing · authorship  ← Білдер moves here
```

Why authorship belongs with courses and not with roles — the module already
says it, and it is worth repeating because it is the part that looks mergeable
and is not:

> builder access — `lms_courses.author_id`, per row, NOT a role. An "author"
> role would say "may edit courses", not "may edit THESE courses".

`coach` and `author_id` answer different questions. They look adjacent because
the same person usually holds both, not because they are one field.

## 4. Done now

The **role facet on Акаунти** — search plus `all / with a role / coach /
support / admin`, filtered in the query rather than on the page (filtering after
`range()` would page through accounts and throw most of each page away, so
"coaches" could come back empty on page 1 with three sitting on page 2).

This is deliberately the first step: it gives the Акаунти list the one thing
Ролі was for. Whether Ролі then still earns a tab is a question the panel can
answer from use rather than from this document.

## 5. Done, in three steps

All three were taken, in the order below.

**1. Roles retired into the facet.** `ownedCourses` and the role's `updated_at`
moved onto the account row first — they were the only facts that lived nowhere
else — then the tab, `listRoles`, `RoleRow` and `GET /access/roles` went. What
`listRoles` proved is now proved of `listAccounts` with the filter. The old
email form is no loss: it called `setRole`, which 404s on an account that does
not exist, so it only ever worked for accounts the per-row select already
covers.

**2. Учні folded in.** `listPeople` replaces both list functions. It pages in
memory, which is forced rather than chosen: status is a fold over the event log,
so it can never be a WHERE clause. `GET /access/accounts` is gone; its facets
are parameters on the one list endpoint.

**3. Білдер moved to `/admin/catalog`** as a third tab, and its component left
the access page for `src/components/admin/CourseAuthorshipTab.tsx`. Its data is
fetched only when the tab is first opened — two reads on arrival for a tab most
visits never touch is a cost worth avoiding.

The access page has no tab bar now: three views of people became one list with
facets, and the fourth was a view of courses that belonged on the courses page.

### Open: what the list is called

The tab was labelled "Ролі" while there were two. With the bar gone the label
went with it, and the page's own title ("Доступи") is what names the list. If a
heading is wanted over it, "Ролі" is no longer quite right — the list is
everyone, and roles are one facet of it among four.

## 6. Not done — was needed for the decision

This section is kept as the record of what each step was expected to cost,
written before any of them were taken. All three have since been done — see
section 5 — and the costs turned out as described.

1. **Retire Ролі**, once the facet has proved it. What is lost: `ownedCourses`
   and `updatedAt`, neither shown anywhere else.
2. **Fold Учні into the people list** as an "access" facet. Bigger: Учні carries
   the status summary and the per-status sub-tabs, which are themselves facets
   on a facet.
3. **Move Білдер to `/admin/catalog`** as a third tab. Mechanical, but it moves
   a route boundary, and the catalogue page has its own canon entry.

## Sources

- Nielsen Norman Group, *Filters vs. Facets: Definitions* —
  https://www.nngroup.com/articles/filters-vs-facets/
- Nielsen Norman Group, *Defining Helpful Filter Categories and Values* —
  https://www.nngroup.com/articles/filter-categories-values/
- GitHub Docs, *Viewing people's roles in an organization* —
  https://docs.github.com/en/account-and-profile/how-tos/organization-membership/viewing-peoples-roles-in-an-organization
- GitHub Docs, *Using organization roles* —
  https://docs.github.com/en/organizations/managing-peoples-access-to-your-organization-with-roles/using-organization-roles
