import pandas as pd
from collections import Counter
import re
from wordcloud import WordCloud, STOPWORDS
import matplotlib.pyplot as plt
import os
import json

# Load prompts.csv (columns: user_id, name, question, answer)
df = pd.read_csv('prompts.csv')

# Group all answers by question
grouped = df.groupby('question')['answer'].apply(lambda x: ' '.join(str(r) for r in x if pd.notnull(r)))

# Function to count words
def word_counts(text):
    # Normalize curly apostrophes and similar Unicode punctuation to straight '
    text = text.replace("’", "'").replace("‘", "'").replace("`", "'")
    # Match words with apostrophes and hyphens (e.g., don't, self-esteem)
    words = re.findall(r"\b[\w'-]+\b", text.lower())
    # Remove stopwords and single-letter words (except 'i' and 'a')
    return Counter(w for w in words if w not in STOPWORDS and (len(w) > 1 or w in {'i', 'a'}))

# Create output directory for word clouds
os.makedirs('wordclouds', exist_ok=True)


# Generate and save word clouds for each question, and build prompt map
prompt_map = {}
for question, text in grouped.items():
    counts = word_counts(text)
    if not counts:
        continue
    # Remove words from counts that appear in the question (prompt)
    prompt_words = set(re.findall(r"\b[\w'-]+\b", question.lower()))
    for w in prompt_words:
        counts.pop(w, None)
    wc = WordCloud(
        width=1350,
        height=675,
        background_color=None,  # Transparent background
        mode='RGBA',            # Ensure alpha channel
        regexp=r"\b[\w'-]+\b",
        normalize_plurals=False
    ).generate_from_frequencies(counts)
    fig = plt.figure(figsize=(13.5, 6.75), facecolor='none')
    ax = plt.gca()
    ax.set_facecolor('none')
    plt.imshow(wc, interpolation='bilinear')
    plt.axis('off')
    # Save each word cloud as a PNG file (sanitize filename)
    safe_question = re.sub(r'[^\w\-_\. ]', '_', question)[:50]
    filename = f'{safe_question}.png'
    plt.savefig(f'wordclouds/{filename}', bbox_inches='tight', transparent=True)
    plt.close()
    prompt_map[question] = f'wordclouds/{filename}'

# Save prompt map as JSON
with open('wordclouds/prompts.json', 'w', encoding='utf-8') as f:
    json.dump(prompt_map, f, ensure_ascii=False, indent=2)

print('Word clouds and prompts.json saved in the wordclouds/ directory.')