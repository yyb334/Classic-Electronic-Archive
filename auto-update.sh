#!/bin/bash

echo "🔁 Watching songs.json for changes..."
fswatch -o songs.json | while read f; do
  echo "🔃 Detected change, committing and pushing..."
  git add songs.json
  git commit -m "Auto-update: updated songs.json"
  git push
  echo "✅ Pushed to GitHub!"
done

