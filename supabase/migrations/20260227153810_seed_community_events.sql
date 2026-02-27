insert into community_events (name, description, platform, target, recurrence_rule, suggested_post_type, tags) values
  ('Saturday Showcase', 'Share your projects on r/webdev', 'reddit', 'r/webdev', 'FREQ=WEEKLY;BYDAY=SA', 'self', '{webdev,showcase,weekly}'),
  ('Self-Promotion Saturday', 'Promote your side projects', 'reddit', 'r/SideProject', 'FREQ=WEEKLY;BYDAY=SA', 'link', '{sideproject,promotion,weekly}'),
  ('Milestone Monday', 'Share your startup milestones', 'reddit', 'r/startups', 'FREQ=WEEKLY;BYDAY=MO', 'self', '{startups,milestones,weekly}'),
  ('Feedback Friday', 'Get design feedback from the community', 'reddit', 'r/design', 'FREQ=WEEKLY;BYDAY=FR', 'self', '{design,feedback,weekly}'),
  ('#BuildInPublic Hour', 'Share your build progress', 'twitter', '#BuildInPublic', 'FREQ=DAILY', 'text', '{buildinpublic,daily}'),
  ('Best Posting Window', 'Optimal LinkedIn engagement window (Tue-Thu)', 'linkedin', null, 'FREQ=WEEKLY;BYDAY=TU,WE,TH', 'text', '{linkedin,engagement,weekly}');
