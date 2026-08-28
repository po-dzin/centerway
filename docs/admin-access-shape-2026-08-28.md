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

## 5. Not done — needs a decision

Each of these removes something an operator uses daily, so none was taken
unilaterally.

1. **Retire Ролі**, once the facet has proved it. What is lost: `ownedCourses`
   and `updatedAt`, neither shown anywhere else. Add them to the account row
   first, then drop the tab and `listRoles` with it.
2. **Fold Учні into the people list** as an "access" facet. Bigger: Учні carries
   the status summary (Не почав / У процесі / Застряг / Завершив) and the
   per-status sub-tabs, which are themselves facets on a facet. Worth doing, not
   worth doing carelessly.
3. **Move Білдер to `/admin/catalog`** as a third tab. Mechanical — the tab is
   already course-shaped and posts to `/api/admin/access/courses` — but it moves
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
