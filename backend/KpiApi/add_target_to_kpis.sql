-- Add Target column to Kpis table
-- This migration adds target values for KPIs to support performance calculations

ALTER TABLE Kpis 
ADD Target DECIMAL(18,2) NOT NULL DEFAULT 100.0;

-- Update existing KPIs with reasonable target values based on their weights
-- You may want to adjust these values based on your specific requirements
UPDATE Kpis SET Target = 100.0 WHERE Target = 0;

-- Example updates for specific KPI types (uncomment and modify as needed):
-- UPDATE Kpis SET Target = 5 WHERE Title LIKE '%Publications%';
-- UPDATE Kpis SET Target = 10 WHERE Title LIKE '%Supervision%';
-- UPDATE Kpis SET Target = 90 WHERE Title LIKE '%Teaching%' OR Title LIKE '%Course%';
-- UPDATE Kpis SET Target = 3 WHERE Title LIKE '%Research%';

-- Create index on Target for better query performance
CREATE INDEX IX_Kpis_Target ON Kpis(Target);