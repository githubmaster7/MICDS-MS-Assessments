# User Guide

A step-by-step guide for each of the four account types. No prior familiarity
with the system is assumed.

---

## Admin

The admin approves new accounts, sets up groups and classes, and runs the
rotation schedule. Everything else in the app depends on the admin doing
these steps first.

- **Sign in** at the login page with your admin email and password.
- **Approve new accounts** (Admin → Signup Requests):
  - New students, teachers, and parents show up here after they register and
    verify their email — nothing else in the app works for them until you
    approve them.
  - Click **Approve** on a request. The person's typed name pre-fills the
    first/last name fields — check them, then fill in the rest:
    - **Student:** grade level, gender, and a student ID. MICDS doesn't issue
      one of these for this app to look up — just type any unique value you
      want (e.g. a running number like S001, S002, ...). It only needs to be
      unique per student; nothing else depends on its format.
    - **Teacher:** an employee ID, same idea — make up any unique value
      (e.g. T001, T002, ...).
    - **Parent:** confirm which child(ren) they searched for at signup
      (uncheck any that shouldn't be linked).
  - Click **Approve** again to finish. Use **Reject** instead if the request
    shouldn't go through.
- **Create a group** (Admin → Groups):
  - Click **New group**, give it a name, and set its grade level and gender.
    A group is one cohort of students (e.g. "6th Grade Boys - Group A") that
    stays together for the whole school year.
  - Open the group and click **Add student** to search for and add students
    — only students matching the group's grade/gender will show up.
- **Set up classes and teachers** (Admin → Teachers & Classes):
  - Click **Add class** to create an activity (e.g. "Wrestling"). Pick a name
    from the dropdown (this auto-fills the standard questions/rubric) or
    choose "Other" for a custom name, then set its grade level and gender.
  - Click **Assign teacher** to pair a teacher with one of these classes.
    A teacher can be assigned to more than one class.
- **Build the rotation schedule** (Admin → Carousel & Rotations):
  - Find your group and click **Set up rotation**.
  - Pick the teacher/class pairs the group will rotate through, in order —
    the first one becomes the group's current class immediately, the rest
    are scheduled as upcoming. Set the first rotation's start/end dates,
    then click **Create positions**.
- **Rotate a group to its next class**, once the current one is done:
  - Check the specific group(s) you want to rotate (leave others unchecked —
    each group rotates independently).
  - Click **Preview selected** to double-check what will change, then
    **Rotate selected**.
  - Confirm the new start/end dates. If you're rotating early, you'll be
    warned and asked to explicitly override it.
  - Type **ROTATE** in the confirmation box and click **Rotate now**. The
    previous class locks (read-only, grades final) and the new one opens up
    for grading.
- **Review the system** — every list page (Groups, Teachers, Classes,
  Students, Users, Audit Logs) is read-only oversight: click into any group,
  teacher, or class to see the same 4-standard analytics and per-student
  breakdown from that angle.
- **Manage parent-child links** (Admin → Parents) if a parent needs a child
  added or removed after their initial approval.
- **Sign out** from Settings in the sidebar.

---

## Teacher

Teachers grade the students in whatever class they're currently assigned to.
Your own score always overrides the student's self-score — the student's
number is shown for reference only, never counted.

- **Sign in**, or **Request Access** if you don't have an account yet (an
  admin has to approve you before you can log in).
- **Your dashboard** shows the class and group you're currently teaching,
  how many students you've graded, and a list of past and upcoming classes.
- **Grade your students**:
  - Click **Grade Students**, then pick a student from the list on the left.
  - For each of the 4 Standards, click a score (1–4) for every skill or
    question. The student's own self-rating (if they've submitted) is shown
    next to yours for comparison — it never affects the final grade.
  - Fill in the **Approach to Learning** section the same way (Responsible &
    Prepared, Respectful & Works Well, Effort), plus how many days the
    student was late or unprepared. This is informational and doesn't affect
    the letter grade.
  - Add written feedback if you want, and toggle whether the student can see
    it.
  - Click **Save**. Repeat for each student in the roster.
- **Check a student's history**: each student's card has buttons for their
  **resubmission history** (every time they resubmitted, with timestamps and
  what changed) and **grading history** (every time you graded/regraded
  them).
- **View class analytics**: click **View Class Analytics** to see 4
  pie-chart graphs (one per standard) showing how the whole class scored —
  hover a slice to see exactly which students make up that count — plus the
  Approach to Learning averages and every student's overall letter grade.
  There's no single "class letter grade," only individual student grades.
- **After a rotation**: your previous class moves to "Past Classes" and
  locks — no more grading changes allowed there. Your new class opens up
  with nothing graded yet.
- **Sign out** from the sidebar.

---

## Student

You score yourself first, then your teacher grades you — only the teacher's
score counts toward your grade.

- **Request Access** to sign up with your MICDS email, verify your email,
  and wait for an admin to approve your account before you can log in.
- **Your dashboard** shows your current class, teacher, overall grade, and
  your average for each of the 4 standards.
- **Submit your work**:
  - Click **Submit Work**.
  - Go through each of the 4 Standard tabs. Rate yourself 1–4 on each skill
    or question, and type your written answers where asked.
  - Fill out the **Approach to Learning** tab — rate your own effort this
    rotation.
  - Check the **Honor Code** box (required before you can submit).
  - Click **Submit Work**.
- **Resubmitting**: if you want to change an answer or score later (and your
  class hasn't locked yet), go back to the same page, change at least one
  score or answer, and click **Resubmit Work**. Every past attempt is saved
  with a timestamp so you (and your teacher) can see exactly what changed.
- **Your scores won't move until your teacher grades you** — self-scores are
  just for your own reflection.
- **My Classes** page shows your whole year: pie charts for each standard
  pooling every class you've been graded in (hover a slice to see which
  class each score came from), your Approach to Learning summary, and a card
  for every class you've had — Active, Locked, or Upcoming — with its letter
  grade once it's graded.
- **Sign out** from the sidebar.

---

## Parent

You can only see the data for your own linked child (or children) — nothing
else in the system.

- **Request Access**: search for your child by name or student ID, select
  them, then submit and wait for an admin to approve your account.
- **Sign in** once approved.
- **Your dashboard** (read-only) shows, for the selected child:
  - If you have more than one child linked, switch between them using the
    buttons at the top.
  - **Overall Grade** and their average for each of the 4 standards.
  - **Score Distribution** charts pooling every class this year — hover a
    slice to see which class each score came from.
  - **Approach to Learning** ratings.
  - **Class History** — every class, its dates, status, and letter grade.
- **Click into a class** in the history list to see your child's own answers
  and self-ratings side by side with the teacher's score and feedback for
  that specific class.
- **Sign out** from the sidebar.
