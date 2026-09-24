-- Prevent more than one open attendance record per employee.
CREATE UNIQUE INDEX "Attendance_one_open_per_user_idx"
ON "Attendance" ("userId")
WHERE "clockOut" IS NULL;