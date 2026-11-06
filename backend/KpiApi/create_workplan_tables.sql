-- Create StandardWorkplans table
CREATE TABLE IF NOT EXISTS `StandardWorkplans` (
    `Id` int NOT NULL AUTO_INCREMENT,
    `Title` varchar(200) CHARACTER SET utf8mb4 NOT NULL,
    `Description` varchar(1000) CHARACTER SET utf8mb4 NULL,
    `AcademicYear` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
    `Semester` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
    `TargetRole` varchar(50) CHARACTER SET utf8mb4 NOT NULL,
    `TeachingActivities` longtext CHARACTER SET utf8mb4 NOT NULL,
    `ResearchActivities` longtext CHARACTER SET utf8mb4 NOT NULL,
    `ServiceActivities` longtext CHARACTER SET utf8mb4 NOT NULL,
    `AdministrativeActivities` longtext CHARACTER SET utf8mb4 NOT NULL,
    `ProfessionalDevelopment` longtext CHARACTER SET utf8mb4 NOT NULL,
    `Objectives` longtext CHARACTER SET utf8mb4 NOT NULL,
    `ExpectedOutcomes` longtext CHARACTER SET utf8mb4 NOT NULL,
    `IsActive` tinyint(1) NOT NULL DEFAULT 1,
    `CreatedAt` datetime(6) NOT NULL,
    `UpdatedAt` datetime(6) NULL,
    `CreatedById` varchar(255) CHARACTER SET utf8mb4 NULL,
    CONSTRAINT `PK_StandardWorkplans` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_StandardWorkplans_AspNetUsers_CreatedById` FOREIGN KEY (`CreatedById`) REFERENCES `AspNetUsers` (`Id`) ON DELETE SET NULL
) CHARACTER SET=utf8mb4;

-- Create WorkplanAssignments table
CREATE TABLE IF NOT EXISTS `WorkplanAssignments` (
    `Id` int NOT NULL AUTO_INCREMENT,
    `StandardWorkplanId` int NOT NULL,
    `AssigneeId` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `AssignedById` varchar(255) CHARACTER SET utf8mb4 NOT NULL,
    `Status` varchar(50) CHARACTER SET utf8mb4 NOT NULL DEFAULT 'Assigned',
    `AssignedAt` datetime(6) NOT NULL,
    `StartedAt` datetime(6) NULL,
    `CompletedAt` datetime(6) NULL,
    `ReviewedAt` datetime(6) NULL,
    `AssignmentNotes` longtext CHARACTER SET utf8mb4 NULL,
    `CompletionNotes` longtext CHARACTER SET utf8mb4 NULL,
    `ReviewFeedback` longtext CHARACTER SET utf8mb4 NULL,
    `Progress` int NOT NULL DEFAULT 0,
    `IsActive` tinyint(1) NOT NULL DEFAULT 1,
    CONSTRAINT `PK_WorkplanAssignments` PRIMARY KEY (`Id`),
    CONSTRAINT `FK_WorkplanAssignments_AspNetUsers_AssignedById` FOREIGN KEY (`AssignedById`) REFERENCES `AspNetUsers` (`Id`) ON DELETE RESTRICT,
    CONSTRAINT `FK_WorkplanAssignments_AspNetUsers_AssigneeId` FOREIGN KEY (`AssigneeId`) REFERENCES `AspNetUsers` (`Id`) ON DELETE RESTRICT,
    CONSTRAINT `FK_WorkplanAssignments_StandardWorkplans_StandardWorkplanId` FOREIGN KEY (`StandardWorkplanId`) REFERENCES `StandardWorkplans` (`Id`) ON DELETE CASCADE
) CHARACTER SET=utf8mb4;

-- Create indexes
CREATE INDEX IF NOT EXISTS `IX_StandardWorkplans_CreatedById` ON `StandardWorkplans` (`CreatedById`);
CREATE INDEX IF NOT EXISTS `IX_StandardWorkplans_TargetRole` ON `StandardWorkplans` (`TargetRole`);
CREATE INDEX IF NOT EXISTS `IX_StandardWorkplans_AcademicYear_Semester` ON `StandardWorkplans` (`AcademicYear`, `Semester`);

CREATE INDEX IF NOT EXISTS `IX_WorkplanAssignments_AssignedById` ON `WorkplanAssignments` (`AssignedById`);
CREATE INDEX IF NOT EXISTS `IX_WorkplanAssignments_AssigneeId` ON `WorkplanAssignments` (`AssigneeId`);
CREATE INDEX IF NOT EXISTS `IX_WorkplanAssignments_Status` ON `WorkplanAssignments` (`Status`);
CREATE INDEX IF NOT EXISTS `IX_WorkplanAssignments_AssignedAt` ON `WorkplanAssignments` (`AssignedAt`);
CREATE INDEX IF NOT EXISTS `IX_WorkplanAssignments_StandardWorkplanId` ON `WorkplanAssignments` (`StandardWorkplanId`);
CREATE UNIQUE INDEX IF NOT EXISTS `IX_WorkplanAssignments_StandardWorkplanId_AssigneeId` ON `WorkplanAssignments` (`StandardWorkplanId`, `AssigneeId`);

-- Insert sample standard workplans
INSERT INTO `StandardWorkplans` (`Title`, `Description`, `AcademicYear`, `Semester`, `TargetRole`, `TeachingActivities`, `ResearchActivities`, `ServiceActivities`, `AdministrativeActivities`, `ProfessionalDevelopment`, `Objectives`, `ExpectedOutcomes`, `IsActive`, `CreatedAt`) VALUES
('HOD Academic Leadership 2024/2025', 'Comprehensive workplan for Head of Department responsibilities and objectives for the academic year 2024/2025', '2024/2025', 'academic', 'HOD', 
'Oversee departmental teaching quality, mentor junior faculty, coordinate course scheduling and curriculum development', 
'Lead departmental research initiatives, secure funding, supervise postgraduate research, publish in high-impact journals', 
'Serve on university committees, represent department in faculty meetings, engage with professional bodies and industry partners', 
'Manage departmental budget, coordinate with administration, prepare reports, handle personnel matters and strategic planning', 
'Attend leadership workshops, participate in academic conferences, pursue professional development in management and academia', 
'Enhance departmental reputation, improve teaching quality, increase research output, strengthen industry partnerships', 
'20% increase in research publications, improved student satisfaction scores, successful accreditation, expanded industry collaborations', 
1, NOW()),

('Lecturer Teaching & Research 2024/2025', 'Standard workplan for lecturers focusing on teaching excellence and research contributions for academic year 2024/2025', '2024/2025', 'academic', 'Lecturer', 
'Deliver assigned courses with excellence, develop innovative teaching materials, mentor students, participate in curriculum review', 
'Conduct research in area of specialization, publish research papers, apply for research grants, collaborate with colleagues', 
'Participate in departmental committees, contribute to community outreach, engage in peer review activities, support student activities', 
'Complete administrative tasks efficiently, participate in departmental meetings, contribute to policy development', 
'Attend workshops on teaching methodologies, pursue further qualifications, participate in professional conferences', 
'Achieve teaching excellence, contribute to knowledge through research, support departmental goals, develop professional skills', 
'High student evaluation scores, at least 2 research publications, successful grant applications, professional skill development', 
1, NOW()),

('First Semester Focus Plan 2024/2025', 'Intensive workplan for first semester activities and objectives', '2024/2025', 'first', 'Lecturer', 
'Focus on course delivery for first semester subjects, prepare comprehensive course materials, conduct regular assessments', 
'Initiate new research projects, complete literature reviews, establish research methodology, begin data collection', 
'Join at least one departmental committee, participate in orientation programs, engage with new students', 
'Complete semester planning, prepare teaching schedules, organize office hours and consultation sessions', 
'Attend new faculty orientation, participate in teaching skills workshops, establish research networks', 
'Establish strong foundation for academic year, build student rapport, initiate research activities', 
'Successful course completion, positive student feedback, research project initiation, professional network establishment', 
1, NOW()),

('Dean Strategic Leadership 2024/2025', 'Comprehensive strategic workplan for Dean focusing on faculty leadership and institutional development', '2024/2025', 'academic', 'Dean', 
'Oversee faculty teaching standards, promote pedagogical innovation, ensure quality assurance across all departments', 
'Develop faculty research strategy, facilitate interdisciplinary collaboration, secure major research funding, establish research partnerships', 
'Lead faculty committees, represent faculty at university level, engage with external stakeholders, promote community partnerships', 
'Manage faculty budget and resources, coordinate strategic planning, oversee personnel development, ensure regulatory compliance', 
'Participate in higher education leadership programs, engage in strategic planning workshops, maintain professional networks', 
'Enhance faculty reputation, improve academic standards, increase research impact, strengthen external partnerships', 
'Improved faculty rankings, increased research funding, enhanced accreditation status, expanded strategic partnerships', 
1, NOW());

-- Update migration history to mark the new migration as applied
INSERT INTO `__EFMigrationsHistory` (`MigrationId`, `ProductVersion`) 
VALUES ('20250917112116_AddStandardWorkplanAndAssignmentModels', '8.0.0')
ON DUPLICATE KEY UPDATE `ProductVersion` = '8.0.0';