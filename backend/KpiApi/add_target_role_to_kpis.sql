-- Add TargetRole column to Kpis table
-- This migration adds role-based filtering for KPIs

ALTER TABLE Kpis 
ADD TargetRole NVARCHAR(20) NOT NULL DEFAULT 'Lecturer';

-- Update existing KPIs to have appropriate target roles
-- You may want to set specific values based on your existing data
-- For now, setting all existing KPIs to 'Lecturer' as default
-- UPDATE Kpis SET TargetRole = 'Dean' WHERE /* your condition for Dean KPIs */;
-- UPDATE Kpis SET TargetRole = 'HOD' WHERE /* your condition for HOD KPIs */;

-- Create index on TargetRole for better query performance
CREATE INDEX IX_Kpis_TargetRole ON Kpis(TargetRole);