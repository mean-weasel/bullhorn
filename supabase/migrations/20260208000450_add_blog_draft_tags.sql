-- Add tags column to blog_drafts for categorizing drafts as "Blog Post", "Twitter Article", or both
ALTER TABLE blog_drafts ADD COLUMN tags text[] DEFAULT '{}';
