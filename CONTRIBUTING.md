# কাজের নিয়ম (Branch Rules)

```
delwer / kamrul  →  develop  →  main
  (নিজের কাজ)      (টেস্টিং)    (রিলিজ)
```

| Branch    | কে ব্যবহার করবে | নিয়ম |
|-----------|-----------------|-------|
| `delwer`  | Delwer          | নিজের কাজ এখানে push |
| `kamrul`  | Kamrul          | নিজের কাজ এখানে push |
| `develop` | সবাই (PR দিয়ে) | সরাসরি push নয়, শুধু PR |
| `main`    | শুধু PR দিয়ে    | @bnfcorporate-এর approval লাগবে** |

## প্রতিদিনের কাজ

```bash
git checkout kamrul            # নিজের branch
git pull origin develop        # আগে develop-এর নতুন কোড নিয়ে নাও
# ... কাজ করো ...
git add . && git commit -m "feat: ..."
git push origin kamrul
```

তারপর GitHub-এ PR খোলো: `kamrul` → `develop`।

## develop → main

1. `develop`-এ সব ঠিক থাকলে `develop` → `main` PR খোলো।
2. `PR Check` সবুজ হতে হবে।
3. bnfcorporate approve করলে merge।
4. রিলিজ বানাতে হলে `main`-এ version tag দাও (`v8.0.3` ইত্যাদি)। শুধু tag দিলেই build শুরু হয়।

## মনে রাখো

- `main` বা `develop`-এ কখনো সরাসরি push না।
- PR ছোট রাখো। একটা PR-এ একটা কাজ।
- কাজ শুরুর আগে সবসময় `git pull origin develop`।
