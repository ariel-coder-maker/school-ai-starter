#!/usr/bin/env bash
# The engine, end to end, in practice mode: no AI, no cost, no keys.
#
#   bash engine/test/practice_test.sh            (from the kit folder)
#
# Copies the kit to a temporary folder, adds the sample school, starts the
# engine there as its own Docker project (kit_test, on ports 5690 and 3010),
# runs every step and every refusal, checks each result, then removes the test
# project and its data. It never touches your kit folder or your engine.
set -u
KIT="$(cd "$(dirname "$0")/../.." && pwd)"
T="$(mktemp -d)"
P=kit_test
pass=0; fail=0
ok()   { pass=$((pass+1)); echo "  pass  $1"; }
bad()  { fail=$((fail+1)); echo "  FAIL  $1"; echo "        got: $(echo "$2" | tail -3 | tr '\n' ' ')"; }
expect() { local name="$1" want="$2"; shift 2; local got; got="$("$@" 2>&1)"; if echo "$got" | grep -qE "$want"; then ok "$name"; else bad "$name" "$got"; fi; }
E() { docker exec ${P}-engine-1 "$@"; }

# MSYS_NO_PATHCONV (Git Bash on Windows) stops /paths inside containers being rewritten.
cleanup() {
  if [ "${KEEP:-0}" = "1" ]; then echo "KEEP=1: test project left running in $T (stop: docker compose -p $P -f $T/engine/docker-compose.yml down -v)"; return; fi
  docker compose -f "$T/engine/docker-compose.yml" -p $P down -v >/dev/null 2>&1; rm -rf "$T"
}
trap cleanup EXIT

echo "Copying the kit to $T"
(cd "$KIT" && tar --exclude=.git --exclude=node_modules --exclude=00_school/*.md --exclude=06_outputs/*/ -cf - .) | (cd "$T" && tar -xf -)
cp -r "$KIT/examples/sample_school/"{00_school,01_curriculum,03_resources,05_checks} "$T/"
cp "$T/engine/.env.example" "$T/engine/.env"
sed -i 's/^N8N_PORT=.*/N8N_PORT=5690/; s/^ENGINE_PORT=.*/ENGINE_PORT=3010/; s/^POSTGRES_PASSWORD=.*/POSTGRES_PASSWORD=kit-test-only/' "$T/engine/.env"
echo "ENGINE_PRACTICE=1" >> "$T/engine/.env"

echo "Starting the engine (first start installs its libraries: about a minute)"
docker compose -f "$T/engine/docker-compose.yml" -p $P down -v >/dev/null 2>&1
docker compose -f "$T/engine/docker-compose.yml" -p $P up -d >/dev/null 2>&1 || { echo "docker compose failed"; exit 1; }
for i in $(seq 1 120); do docker logs ${P}-engine-1 2>&1 | grep -q "Engine ready" && break; sleep 2; done
docker logs ${P}-engine-1 2>&1 | grep -q "Engine ready" || { echo "The engine did not start:"; docker logs ${P}-engine-1 2>&1 | tail -20; exit 1; }

U="--subject science --unit grade_7_t1_forces"
D=01_curriculum/science/units/grade_7_t1_forces
O=06_outputs/test_teacher/science_grade_7_t1_forces
L="--teacher Test_Teacher"

echo "First run"
expect "first_run finds the sample school"           "framework VERIFIED"           E node first_run.js
expect "the practice model is ready"                 "practice"                     E node chain.js

echo "Gates"
expect "sequence refused before an outline exists"   "has not been made yet"        E node step.js sequence $U
expect "outline made, every check passed"            "Every check passed"           E node step.js outline --subject science --grade "Grade 7" --term 1 --topic Forces
expect "sequence refused until outline approved"     "waiting for approval"         E node step.js sequence $U
expect "approval needs a name"                       "Say who is approving"         E node approve.js $D/1_outline.md
expect "outline approved, Word file made"            "1_outline.docx"               E node approve.js $D/1_outline.md --by "Test Teacher"
expect "sequence made, every check passed"           "Every check passed"           E node step.js sequence $U
expect "sequence approved"                           "Approved"                     E node approve.js $D/2_sequence.md --by "Test Teacher"
expect "assessment made"                             "Made .*3_assessment"          E node step.js assessment $U
expect "assessment approved"                         "Approved"                     E node approve.js $D/3_assessment.md --by "Test Teacher"
expect "rubric made"                                 "Made .*3_rubric"              E node step.js rubric $U
expect "worksheet refused before its lesson"         "has not been made yet"        E node step.js worksheet $U --lesson 3 $L
expect "lesson made, minutes add up"                 "pass  Minutes add up"         E node step.js lesson $U --lesson 3 $L
expect "lesson approved, Word file made"             "L03_lesson.docx"              E node approve.js $O/L03_lesson.md --by "Test Teacher"
expect "worksheet made"                              "Made .*L03_worksheet"         E node step.js worksheet $U --lesson 3 $L
expect "slides made"                                 "Made .*L03_slides"            E node step.js slides $U --lesson 3 $L
expect "slides approved, PowerPoint made"            "L03_slides.pptx"              E node approve.js $O/L03_slides.md --by "Test Teacher"
expect "order list made from approved sequences"     "Made .*term1"                 E node step.js order_list --term 1
expect "a path outside the kit is refused"           "not a file the engine works"  E node approve.js ../../etc/passwd --by x

echo "Checks catch bad work"
python3 - "$T/$D/2_sequence.md" "$T/06_outputs/bad_sequence.md" <<'PY'
import sys, re
s = open(sys.argv[1], encoding='utf-8').read()
s = s.replace('| I.1, I.2, I.3 | ramps', '| I.1, I.2 | ramps')
s = re.sub(r'\n\| 10 \|[^\n]*', '', s).replace('| low-load |', '| concept |')
open(sys.argv[2], 'w', encoding='utf-8').write(s)
PY
expect "wrong lesson count caught"                   "FAIL  Exactly the number"     E node check.js 06_outputs/bad_sequence.md --kind sequence --subject science
expect "strand assessed without practice caught"     "never practised first: I.3"   E node check.js 06_outputs/bad_sequence.md --kind sequence --subject science
expect "formative missing a strand caught"           "lesson 4 misses I.3"          E node check.js 06_outputs/bad_sequence.md --kind sequence --subject science
expect "no low-load after the summative caught"      "FAIL  The lesson after"       E node check.js 06_outputs/bad_sequence.md --kind sequence --subject science
python3 - "$T/$O/L03_lesson.md" "$T/06_outputs/bad_lesson.md" <<'PY'
import sys
s = open(sys.argv[1], encoding='utf-8').read()
s = s.replace('| 6 | Toy cars | 14 | investigate', '| 6 | Toy cars | 9 | we-do').replace('Students can explain whether', 'Students understand whether')
open(sys.argv[2], 'w', encoding='utf-8').write(s)
PY
expect "minutes that don't add up caught"            "45 minutes planned, 50"       E node check.js 06_outputs/bad_lesson.md --kind lesson --subject science
expect "same kind of work twice caught"              "we-do\" in sections"          E node check.js 06_outputs/bad_lesson.md --kind lesson --subject science
expect "unobservable objective caught"               "FAIL  The objective"          E node check.js 06_outputs/bad_lesson.md --kind lesson --subject science

echo "Out of date"
printf '\n## Added later\nA teacher edited this after approval.\n' >> "$T/$D/1_outline.md"
expect "edited outline reads as changed"             "outline changed since approval" E node status.js
expect "sequence on the old outline: out of date"    "sequence out of date"         E node status.js
expect "rubric two steps down: out of date too"      "rubric out of date"           E node status.js
expect "approving a stale sequence is refused"       "has changed since"            E node approve.js $D/2_sequence.md --by "Test Teacher"
expect "a new lesson waits for re-approval"          "Approve it again"             E node step.js lesson $U --lesson 4 $L
E node approve.js $D/1_outline.md --by "Test Teacher" >/dev/null 2>&1
E node step.js sequence $U >/dev/null 2>&1
expect "same text on a new outline needs approving"  "sequence (draft|changed since approval)" E node status.js

echo "Teacher page and API"
expect "the teacher page loads"                      "Teacher page"                 curl -s http://127.0.0.1:3010/
expect "the status API answers"                      "\"school\":true"              curl -s http://127.0.0.1:3010/api/status
expect "a refused step comes back as a message"      "Waiting"                      curl -s -X POST -H 'Content-Type: application/json' -d '{"kind":"worksheet","subject":"science","unit":"grade_7_t1_forces","lesson":"9"}' http://127.0.0.1:3010/api/step
expect "n8n is up"                                   "200|302"                      curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5690/
expect "the engine runs as an ordinary user"         "^1000$"                       E id -u

echo "The n8n teacher form"
E node approve.js $D/2_sequence.md --by "Test Teacher" >/dev/null 2>&1
expect "n8n imports the teacher form"                "Successfully imported"        env MSYS_NO_PATHCONV=1 docker exec ${P}-n8n-1 n8n import:workflow --input=/workflows/teacher_form.json
expect "n8n publishes it"                            "Publishing workflow"          docker exec ${P}-n8n-1 n8n publish:workflow --id=MakeAStepForm01
docker restart ${P}-n8n-1 >/dev/null
for i in $(seq 1 60); do docker logs ${P}-n8n-1 2>&1 | grep -q 'Activated workflow "Make a step' && break; sleep 2; done
for i in $(seq 1 30); do curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:5690/form/make-a-step | grep -q 200 && break; sleep 2; done
expect "the form page loads"                         "What to make"                 curl -s http://127.0.0.1:5690/form/make-a-step
R=$(curl -s -X POST http://127.0.0.1:5690/form/make-a-step -F 'field-0=Order list for a term' -F 'field-4=1' -F 'field-7=Test Teacher')
WAIT=$(echo "$R" | grep -oE '"formWaitingUrl":"[^"]*"' | cut -d'"' -f4)
expect "the result link uses the chosen port"        "localhost:5690/"              echo "$WAIT"
for i in $(seq 1 30); do docker exec ${P}-postgres-1 psql -U school_ai -d school_ai -tAc "select count(*) from runs where kind='order_list'" | grep -q '^[2-9]' && break; sleep 2; done
expect "the form reached the engine"                 "^[2-9]"                       docker exec ${P}-postgres-1 psql -U school_ai -d school_ai -tAc "select count(*) from runs where kind='order_list'"
expect "the form's result page says what was made"   "Made: 06_outputs/order_lists/term1.md" curl -s --max-time 30 "${WAIT/localhost/127.0.0.1}"

echo
echo "$pass passed, $fail failed."
[ "$fail" -eq 0 ]
