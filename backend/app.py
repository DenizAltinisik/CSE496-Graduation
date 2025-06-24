from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_jwt_extended import JWTManager, jwt_required, create_access_token, get_jwt_identity
from pymongo import MongoClient
from bson import ObjectId
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import timedelta, datetime, timezone
import os
from dotenv import load_dotenv
from openai import OpenAI
from googleapiclient.discovery import build
import re

# Load environment variables from .env file (override system variables)
load_dotenv(override=True)

app = Flask(__name__)

# JWT configuration - require from .env for security
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY')
if not JWT_SECRET_KEY:
    raise ValueError("JWT_SECRET_KEY environment variable is required")

app.config['JWT_SECRET_KEY'] = JWT_SECRET_KEY
app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=24)

jwt = JWTManager(app)
CORS(app)

# MongoDB connection
client = MongoClient(os.getenv('MONGODB_URI', 'mongodb://localhost:27017/'))
db = client['webapp_db']
users_collection = db['users']
chats_collection = db['chats']
memories_collection = db['memories']
personas_collection = db['personas']
diary_collection = db['diary']
feedback_collection = db['feedback']

# OpenAI configuration
OPENAI_API_KEY = os.getenv('OPENAI_API_KEY')
if not OPENAI_API_KEY:
    raise ValueError("OPENAI_API_KEY environment variable is required")
if not OPENAI_API_KEY.startswith('sk-'):
    raise ValueError("OPENAI_API_KEY must be a valid OpenAI API key (starts with 'sk-')")

openai = OpenAI(
    api_key=OPENAI_API_KEY
)

# YouTube API configuration
YOUTUBE_API_KEY = os.getenv('YOUTUBE_API_KEY')
if YOUTUBE_API_KEY:
    youtube = build('youtube', 'v3', developerKey=YOUTUBE_API_KEY)
else:
    youtube = None

# Multi-level problem solving system prompts
SYSTEM_PROMPTS = {
    "analyzer": """You are a problem analysis expert. Analyze the user's issue in a natural way.
    
In line with persona characteristics:
- Understand the root causes of the problem
- Assess the importance of the situation  
- Consider which approaches might work
- Take into account the user's emotional state

IMPORTANT: Do not start your response with any introductory sentence. Go directly into your analysis.
""",
    
    "strategist": """You are a strategy development expert. Based on the problem analysis, present a natural approach.

Your tasks:
- Build on the analyzed topic
- Suggest actionable steps
- Offer alternative solutions
- Provide recommendations that match the user's personality

IMPORTANT: Do not start your response with any introductory sentence. Go directly into explaining your strategy.
""",
    
    "implementer": """You are an implementation expert. Provide practical solutions based on strategy and analysis.

In line with persona characteristics:
- Suggest concrete, actionable steps
- Explain each step clearly and understandably
- Highlight potential challenges in advance
- Provide tips for success

IMPORTANT: Do not start your response with any introductory sentence. Go directly into explaining the implementation steps."""
}

def search_youtube_video(query, max_results=1):
    """Search for YouTube videos related to the query"""
    try:
        if not YOUTUBE_API_KEY or not youtube:
            return None
            
        # Search for videos
        search_response = youtube.search().list(
            q=query,
            part='id,snippet',
            maxResults=max_results,
            type='video',
            order='relevance'
        ).execute()
        
        if search_response['items']:
            video = search_response['items'][0]
            video_id = video['id']['videoId']
            title = video['snippet']['title']
            description = video['snippet']['description'][:150] + '...' if len(video['snippet']['description']) > 150 else video['snippet']['description']
            thumbnail = video['snippet']['thumbnails']['medium']['url']
            
            return {
                'video_id': video_id,
                'url': f'https://www.youtube.com/watch?v={video_id}',
                'embed_url': f'https://www.youtube.com/embed/{video_id}',
                'title': title,
                'description': description,
                'thumbnail': thumbnail
            }
    except Exception as e:
        return None
    
    return None

def generate_chat_title(user_message):
    """Generate a proper, concise title for the chat based on user's message"""
    try:
        title_response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system", 
                    "content": """You are a chat title generation expert. Create a short, concise and professional title based on the user's message.
                    
Rules:
- Maximum 4-5 words
- Use English
- Use professional and clean language
- Capture the essence of the topic
- Prefer appropriate alternatives to words like "Urgent" or "Help"

Examples:
"how to make ravioli urgent help" → "Ravioli Recipe Guide"
"getting error in python code" → "Python Error Solution"
"preparing for a job interview" → "Job Interview Preparation"
"my math homework is too hard" → "Math Problem Solving"
"what can you do" → "Assistant's Capabilities"

Return only the title, with no additional text."""
                },
                {"role": "user", "content": user_message}
            ],
            max_tokens=50,
            temperature=0.7
        )
        return title_response.choices[0].message.content.strip()
    except:
        # Fallback to simple truncation if GPT fails
        return user_message[:30] + '...' if len(user_message) > 30 else user_message

def extract_memory_info(user_message, user_id):
    """Extract personal information from user message and categorize it"""
    try:
        memory_response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system", 
                    "content": """You are a personal information extraction expert. Extract and categorize personal information from the user's message.

Categories:
- family_friends: Family members, friends, relationships (e.g., "my mom", "my brother", "my best friend")
- favorites: Likes, preferences (e.g., "I love pizza", "my favorite color is blue")
- opinions: Views, thoughts (e.g., "exercise is healthy", "technology makes life easier")
- skills: Abilities, competencies (e.g., "I can play piano", "I know programming")
- personality: Personality traits (e.g., "sentimental", "I love giving gifts", "I'm a perfectionist")
- health: Health conditions, medical issues, symptoms (e.g., "I have diabetes", "my back hurts", "I'm allergic to peanuts")
- others: Other personal information

Respond in JSON format. If no personal information is found, return an empty object.

Example:
Message: "I want to buy a gift for my mom, what should I get"
Response: {
  "family_friends": ["has a mother"],
  "personality": ["gift-giving", "thoughtful"]
}

Return only JSON, nothing else."""
                },
                {"role": "user", "content": user_message}
            ],
            max_tokens=300,
            temperature=0.3
        )
        
        memory_text = memory_response.choices[0].message.content.strip()
        
        # Try to parse JSON response
        import json
        try:
            memory_data = json.loads(memory_text)
            if memory_data:  # Only save if there's actual memory data
                save_memory_info(user_id, memory_data)
            return memory_data
        except json.JSONDecodeError:
            return {}
            
    except Exception as e:
        return {}

def save_memory_info(user_id, memory_data):
    """Save extracted memory information to database"""
    try:
        # Get existing memory or create new one
        existing_memory = memories_collection.find_one({"user_id": user_id})
        
        if existing_memory:
            # Update existing memory by appending new information
            updated_memory = existing_memory.copy()
            for category, items in memory_data.items():
                if category in updated_memory:
                    # Add new items to existing category, avoid duplicates
                    existing_items = set(updated_memory[category])
                    new_items = set(items)
                    updated_memory[category] = list(existing_items.union(new_items))
                else:
                    updated_memory[category] = items
            
            updated_memory['updated_at'] = datetime.now(timezone.utc)
            memories_collection.update_one(
                {"user_id": user_id},
                {"$set": updated_memory}
            )
        else:
            # Create new memory document
            memory_doc = {
                "user_id": user_id,
                "family_friends": memory_data.get("family_friends", []),
                "favorites": memory_data.get("favorites", []),
                "opinions": memory_data.get("opinions", []),
                "skills": memory_data.get("skills", []),
                "personality": memory_data.get("personality", []),
                "health": memory_data.get("health", []),
                "others": memory_data.get("others", []),
                "created_at": datetime.now(timezone.utc),
                "updated_at": datetime.now(timezone.utc)
            }
            memories_collection.insert_one(memory_doc)
            
    except Exception as e:
        return

def get_user_memory_context(user_id, current_topic=""):
    """Get user memory context for personalized responses with relevance filtering"""
    try:
        memory = memories_collection.find_one({"user_id": user_id})
        if not memory:
            return ""
        
        # If we have a current topic, filter memory for relevance
        if current_topic:
            # Use GPT to determine if memory is relevant to current topic
            try:
                relevance_check = openai.chat.completions.create(
                    model="gpt-3.5-turbo",
                    messages=[
                        {
                            "role": "system", 
                            "content": """You are a memory relevance expert. Evaluate whether the user's current topic is relevant to the memory information.
                            
Respond only with 'RELEVANT' or 'NOT_RELEVANT'. Do not write anything else.

Examples:
- Current topic: "building a cage" -> Memory: "C programming knowledge" = NOT_RELEVANT
- Current topic: "building a cage" -> Memory: "woodworking hobby" = RELEVANT
- Current topic: "math problem" -> Memory: "math teacher" = RELEVANT"""
                        },
                        {
                            "role": "user", 
                            "content": f"Current topic: {current_topic}\n\nMemory information:\n{str(memory)}"
                        }
                    ],
                    max_tokens=10,
                    temperature=0.1
                )
                
                relevance_result = relevance_check.choices[0].message.content.strip()
                if relevance_result == "NOT_RELEVANT":
                    return "\n\n--- USER MEMORY ---\nNo specific information found related to this topic.\n"
                    
            except Exception as e:
                # If relevance check fails, use limited memory
                pass
        
        # Build memory context from relevant categories
        memory_parts = []
        categories = {
            'family_friends': 'Family & Friends',
            'favorites': 'Favorites', 
            'opinions': 'Opinions',
            'skills': 'Skills',
            'personality': 'Personality',
            'health': 'Health',
            'others': 'Others'
        }
        
        for category, label in categories.items():
            items = memory.get(category, [])
            if items:
                memory_parts.append(f"{label}: {', '.join(items)}")
        
        if memory_parts:
            return f"\n\n--- USER MEMORY ---\n{chr(10).join(memory_parts)}\n"
        
        return ""
    except Exception as e:
        return ""

def get_conversation_context(chat_session, max_messages=6):
    """Get recent conversation context for GPT to remember previous messages"""
    try:
        messages = chat_session.get('messages', [])
        if not messages:
            return ""
        
        # Get last few messages for context
        recent_messages = messages[-max_messages:] if len(messages) > max_messages else messages
        
        context_parts = []
        for msg in recent_messages:
            role = msg.get('role', '')
            content = msg.get('content', '')
            if role and content:
                # Truncate very long messages
                if len(content) > 300:
                    content = content[:300] + "..."
                context_parts.append(f"{role.upper()}: {content}")
        
        if context_parts:
            return f"\n\n--- CONVERSATION HISTORY ---\n{chr(10).join(context_parts)}\n"
        
        return ""
    except Exception as e:
        return ""

def extract_conversation_memory(user_message, conversation_history):
    """Extract conversation-specific memory from user message and conversation context"""
    try:
        # Get recent conversation context (last 5 messages)
        recent_context = ""
        if conversation_history:
            recent_messages = conversation_history[-10:]  # Last 10 messages for context
            for msg in recent_messages:
                role = "User" if msg['role'] == 'user' else "Assistant"
                recent_context += f"{role}: {msg['content'][:200]}...\n"
        
        memory_response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system", 
                    "content": """You are a conversation memory expert. Extract conversation-specific information from the user's message and conversation history.

ONLY record the following from this specific conversation:
- Temporary situations shared during the conversation (what they did today, where they are now, how they're feeling)
- Specific problems and solutions mentioned in this conversation
- Ideas and decisions that developed during the conversation
- Plans and goals that emerged in this chat
- Examples and references given during the conversation

DO NOT RECORD:
- General personal information (these are in global memory)
- Permanent characteristics (these are in the profile)
- Information from old conversations

Respond in JSON format:
{
  "conversation_facts": [
    "Specific information mentioned in this conversation 1",
    "Specific information mentioned in this conversation 2"
  ]
}

Return an empty array if there is no conversation-specific information."""
                },
                {
                    "role": "user", 
                    "content": f"Last message: {user_message}\n\nConversation history:\n{recent_context}"
                }
            ],
            max_tokens=500,
            temperature=0.3
        )
        
        import json
        memory_data = json.loads(memory_response.choices[0].message.content)
        return memory_data.get('conversation_facts', [])
        
    except Exception as e:
        return []

def save_conversation_memory(chat_id, memory_facts):
    """Save conversation-specific memory facts to the chat document"""
    try:
        if memory_facts:
            # Add new facts to existing conversation memory, avoiding duplicates
            chats_collection.update_one(
                {'_id': ObjectId(chat_id)},
                {
                    '$addToSet': {
                        'conversation_memory': {'$each': memory_facts}
                    }
                }
            )
    except Exception as e:
        return

def get_persona_response_style(persona_data, user_feedback_history):
    """Get persona-specific response style and cooperation level based on feedback"""
    
    # Calculate cooperation level based on feedback history
    cooperation_level = calculate_cooperation_level(user_feedback_history)
    
    role = persona_data.get('role', 'friend')
    traits = persona_data.get('personality_traits', [])
    
    # Define persona-specific response styles
    persona_styles = {
        'friend': {
            'tone': 'samimi ve destekleyici',
            'format': 'doğal sohbet tarzında, arkadaşça',
            'approach': 'empati göster, deneyim paylaş, pratik öneriler ver',
            'avoid': 'resmi dil, madde listesi, robotik cevaplar'
        },
        'boyfriend': {
            'tone': 'sevgi dolu, koruyucu ve anlayışlı',
            'format': 'romantik ve destekleyici, kişisel',
            'approach': 'duygusal destek ver, birlikte çözüm ara, şefkat göster',
            'avoid': 'soğuk analiz, impersonal tavsiyeler'
        },
        'girlfriend': {
            'tone': 'sevgi dolu, empatik ve sıcak',
            'format': 'samimi kız arkadaş sohbeti tarzında',
            'approach': 'duygularını anla, deneyim paylaş, moral ver',
            'avoid': 'teknik analiz, robotik çözümler, soğuk tavsiyeler'
        },
        'spouse_male': {
            'tone': 'destekleyici eş, güvenilir ve anlayışlı',
            'format': 'evlilik deneyimi olan, olgun yaklaşım',
            'approach': 'beraber düşün, uzun vadeli çözümler öner, sabırlı ol',
            'avoid': 'otoriter tavır, hızlı yargılar'
        },
        'spouse_female': {
            'tone': 'destekleyici eş, sıcak ve pratik',
            'format': 'evlilik deneyimi olan, anlayışlı yaklaşım',
            'approach': 'duygusal destek ver, pratik çözümler öner, sabırlı ol',
            'avoid': 'eleştirel tavır, soğuk analiz'
        },
        'brother': {
            'tone': 'koruyucu kardeş, samimi ve direkt',
            'format': 'kardeşçe sohbet, açık ve dürüst',
            'approach': 'koruyucu ol, deneyim paylaş, pratik çözümler ver',
            'avoid': 'fazla ciddi ton, resmi dil'
        },
        'sister': {
            'tone': 'destekleyici kız kardeş, anlayışlı',
            'format': 'kız kardeş sohbeti, samimi ve eğlenceli',
            'approach': 'empati göster, deneyim paylaş, moral ver',
            'avoid': 'ağabeylik taslama, otoriter tavır'
        },
        'mentor': {
            'tone': 'deneyimli rehber, bilge ve destekleyici',
            'format': 'rehberlik eden ama baskıcı olmayan',
            'approach': 'deneyim paylaş, adım adım yönlendir, motivasyon ver',
            'avoid': 'ders verici tavır, fazla teorik bilgi'
        },
        'advisor': {
            'tone': 'profesyonel danışman, objektif',
            'format': 'danışmanlık tarzında ama sıcak',
            'approach': 'seçenekleri göster, pros/cons analizi, kararı sana bırak',
            'avoid': 'kesin yargılar, tek çözüm dayatma'
        },
        'academician': {
            'tone': 'bilgili öğretmen, sabırlı ve açıklayıcı',
            'format': 'eğitici ama sıkıcı olmayan',
            'approach': 'kavramları açıkla, örnekler ver, merak uyandır',
            'avoid': 'fazla akademik jargon, sıkıcı dersler'
        }
    }
    
    base_style = persona_styles.get(role, persona_styles['friend'])
    
    # Adjust style based on personality traits
    if 'Shy' in traits:
        base_style['tone'] += ', nazik ve anlayışlı'
    if 'Energetic' in traits:
        base_style['tone'] += ', enerjik ve coşkulu'
    if 'Caring' in traits:
        base_style['approach'] += ', ekstra empati göster'
    if 'Sassy' in traits:
        base_style['tone'] += ', esprili ve özgüvenli'
    if 'Artistic' in traits:
        base_style['approach'] += ', yaratıcı çözümler öner'
    if 'Logical' in traits:
        base_style['approach'] += ', mantıklı yaklaşım sergile'
    
    # Adjust cooperation based on feedback
    cooperation_instructions = get_cooperation_instructions(cooperation_level)
    
    return {
        'style': base_style,
        'cooperation_level': cooperation_level,
        'cooperation_instructions': cooperation_instructions
    }

def calculate_cooperation_level(feedback_history):
    """Calculate cooperation level (1-5) based on user feedback history"""
    if not feedback_history:
        return 3  # Default medium cooperation
    
    # Count positive vs negative feedback
    positive_count = feedback_history.count('Love') + feedback_history.count('Funny')
    negative_count = feedback_history.count('Meaningless') + feedback_history.count('Offensive')
    total_feedback = len(feedback_history)
    
    if total_feedback == 0:
        return 3
    
    positive_ratio = positive_count / total_feedback
    
    if positive_ratio >= 0.8:
        return 5  # Very cooperative
    elif positive_ratio >= 0.6:
        return 4  # Cooperative
    elif positive_ratio >= 0.4:
        return 3  # Medium
    elif positive_ratio >= 0.2:
        return 2  # Less cooperative
    else:
        return 1  # Minimal cooperation

def get_cooperation_instructions(level):
    """Get cooperation instructions based on level"""
    instructions = {
        1: "Kısa ve öz cevaplar ver. Kullanıcı daha az detay istiyor gibi görünüyor.",
        2: "Orta uzunlukta cevaplar ver. Fazla detaya girme.",
        3: "Dengeli cevaplar ver. Ne çok kısa ne çok uzun.",
        4: "Detaylı ve yardımcı cevaplar ver. Kullanıcı memnun görünüyor.",
        5: "Çok detaylı, yaratıcı ve kapsamlı cevaplar ver. Kullanıcı yanıtlarından çok memnun."
    }
    return instructions.get(level, instructions[3])

def get_user_feedback_history(user_id):
    """Get user's recent feedback history for cooperation level calculation"""
    try:
        # Get recent chats with feedback
        recent_chats = chats_collection.find(
            {'user_id': user_id},
            {'messages': 1}
        ).sort('updated_at', -1).limit(5)
        
        feedback_history = []
        for chat in recent_chats:
            for message in chat.get('messages', []):
                if message.get('role') == 'assistant' and message.get('user_feedback'):
                    feedback_history.append(message['user_feedback'])
        
        return feedback_history[-20:]  # Last 20 feedback items
        
    except Exception as e:
        return []

def get_user_persona_context(user_id):
    """Get user's persona context for GPT prompts"""
    try:
        persona_data = personas_collection.find_one({'user_id': user_id})
        
        if not persona_data:
            return ""
        
        context = "\n\n--- PERSONA BAĞLAMI ---\n"
        context += f"Sen bir {persona_data.get('role', 'asistan')} rolündesin.\n"
        
        if persona_data.get('backstory'):
            context += f"Geçmişin: {persona_data['backstory']}\n"
        
        if persona_data.get('personality_traits'):
            traits = ', '.join(persona_data['personality_traits'])
            context += f"Kişilik özelliklerin: {traits}\n"
        
        if persona_data.get('interests'):
            interests = ', '.join(persona_data['interests'])
            context += f"İlgi alanların: {interests}\n"
        
        context += "Bu persona özelliklerine uygun şekilde yanıt ver.\n"
        
        return context
        
    except Exception as e:
        return ""

def summarize_chat_session(chat_session):
    """Summarize a chat session for diary entry"""
    try:
        messages = chat_session.get('messages', [])
        if not messages:
            return None
        
        # Get user messages only for summarization
        user_messages = [msg['content'] for msg in messages if msg.get('role') == 'user']
        if not user_messages:
            return None
        
        # Combine messages for summarization
        conversation_text = '\n'.join(user_messages)
        
        # Generate summary using GPT
        summary_response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": """You are a diary summary expert. Create a diary entry by summarizing the user's chat conversation.

Çıktı formatı:
BAŞLIK: [Kısa, öz başlık - maksimum 5-6 kelime]
ÖZET: [Konuşmanın ana konularını ve önemli noktalarını özetleyen 2-3 cümle]

Türkçe yanıt ver ve kişisel günlük tarzında yaz."""
                },
                {
                    "role": "user",
                    "content": f"Bu konuşmayı özetle:\n\n{conversation_text}"
                }
            ],
            max_tokens=200,
            temperature=0.7
        )
        
        summary_text = summary_response.choices[0].message.content
        
        # Parse title and summary
        lines = summary_text.split('\n')
        title = ""
        summary = ""
        
        for line in lines:
            if line.startswith('BAŞLIK:'):
                title = line.replace('BAŞLIK:', '').strip()
            elif line.startswith('ÖZET:'):
                summary = line.replace('ÖZET:', '').strip()
        
        # Fallback if parsing fails
        if not title:
            title = "Günlük Konuşma"
        if not summary:
            summary = summary_text[:200] + "..." if len(summary_text) > 200 else summary_text
        
        return {
            'title': title,
            'summary': summary,
            'date': chat_session.get('created_at', datetime.now(timezone.utc)),
            'message_count': len(messages)
        }
        
    except Exception as e:
        return None

def auto_create_diary_entry(user_id, chat_id):
    """Automatically create a diary entry for a new chat session"""
    try:
        # Check if diary entry already exists for this chat
        existing_entry = diary_collection.find_one({'user_id': user_id, 'chat_id': chat_id})
        if existing_entry:
            return existing_entry['_id']
        
        # Create initial diary entry
        diary_entry = {
            'user_id': user_id,
            'chat_id': chat_id,
            'title': 'Yeni Konuşma',
            'summary': 'Konuşma henüz başlamadı...',
            'date': datetime.now(timezone.utc),
            'message_count': 0,
            'created_at': datetime.now(timezone.utc),
            'updated_at': datetime.now(timezone.utc)
        }
        
        result = diary_collection.insert_one(diary_entry)
        print(f"Auto-created diary entry: {result.inserted_id}")
        return result.inserted_id
        
    except Exception as e:
        return None

def auto_update_diary_entry(user_id, chat_id):
    """Automatically update diary entry when chat is updated"""
    try:
        # Get the chat session
        chat_session = chats_collection.find_one({'_id': ObjectId(chat_id), 'user_id': user_id})
        if not chat_session:
            return
        
        # Get diary summary
        diary_summary = summarize_chat_session(chat_session)
        if not diary_summary:
            return
        
        # Update existing diary entry
        diary_collection.update_one(
            {'user_id': user_id, 'chat_id': chat_id},
            {
                '$set': {
                    'title': diary_summary['title'],
                    'summary': diary_summary['summary'],
                    'message_count': diary_summary['message_count'],
                    'updated_at': datetime.now(timezone.utc)
                }
            }
        )
        
        print(f"Auto-updated diary entry for chat: {chat_id}")
        
    except Exception as e:
        return

@app.route('/api/register', methods=['POST'])
def register():
    try:
        data = request.get_json()
        username = data.get('username')
        email = data.get('email')
        password = data.get('password')

        if not username or not email or not password:
            return jsonify({'error': 'All fields are required'}), 400

        # Check if user already exists
        if users_collection.find_one({'$or': [{'username': username}, {'email': email}]}):
            return jsonify({'error': 'User already exists'}), 400

        # Hash password
        hashed_password = generate_password_hash(password)

        # Create user
        user_data = {
            'username': username,
            'email': email,
            'password': hashed_password,
            'profileComplete': False,
            'personaSelected': False,
            'ageGroup': None,
            'pronouns': None,
            'occupation': None
        }
        
        result = users_collection.insert_one(user_data)
        
        # Create access token
        access_token = create_access_token(identity=str(result.inserted_id))
        
        return jsonify({
            'message': 'User created successfully',
            'access_token': access_token,
            'user': {
                'id': str(result.inserted_id),
                'username': username,
                'email': email
            }
        }), 201

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    try:
        data = request.get_json()
        username = data.get('username')
        password = data.get('password')

        if not username or not password:
            return jsonify({'error': 'Username and password are required'}), 400

        # Find user
        user = users_collection.find_one({'username': username})
        
        if not user or not check_password_hash(user['password'], password):
            return jsonify({'error': 'Invalid credentials'}), 401

        # Create access token
        access_token = create_access_token(identity=str(user['_id']))
        
        return jsonify({
            'message': 'Login successful',
            'access_token': access_token,
            'user': {
                'id': str(user['_id']),
                'username': user['username'],
                'email': user['email']
            }
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/user', methods=['GET'])
@jwt_required()
def get_user():
    try:
        current_user_id = get_jwt_identity()
        user = users_collection.find_one({'_id': ObjectId(current_user_id)})
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
            
        return jsonify({
            'user': {
                'id': str(user['_id']),
                'username': user['username'],
                'email': user['email'],
                'profileComplete': user.get('profileComplete', False),
                'personaSelected': user.get('personaSelected', False),
                'ageGroup': user.get('ageGroup'),
                'pronouns': user.get('pronouns'),
                'occupation': user.get('occupation')
            }
        }), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({'status': 'healthy'}), 200

@app.route('/api/complete-profile', methods=['POST'])
@jwt_required()
def complete_profile():
    try:
        current_user_id = get_jwt_identity()
        user = users_collection.find_one({'_id': ObjectId(current_user_id)})
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        data = request.get_json()
        ageGroup = data.get('ageGroup')
        pronouns = data.get('pronouns')
        occupation = data.get('occupation')
        
        users_collection.update_one({'_id': ObjectId(current_user_id)}, {'$set': {
            'ageGroup': ageGroup,
            'pronouns': pronouns,
            'occupation': occupation,
            'profileComplete': True
        }})
        
        return jsonify({
            'message': 'Profile completed successfully'
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/complete-persona-selection', methods=['POST'])
@jwt_required()
def complete_persona_selection():
    try:
        current_user_id = get_jwt_identity()
        user = users_collection.find_one({'_id': ObjectId(current_user_id)})
        
        if not user:
            return jsonify({'error': 'User not found'}), 404
        
        # Mark persona selection as complete
        users_collection.update_one({'_id': ObjectId(current_user_id)}, {'$set': {
            'personaSelected': True
        }})
        
        return jsonify({
            'message': 'Persona selection completed successfully'
        }), 200

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat', methods=['POST'])
@jwt_required()
def chat():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        user_message = data.get('message')
        chat_id = data.get('chat_id')
        
        if not user_message:
            return jsonify({'error': 'Mesaj gerekli'}), 400
        
        # Get or create chat session
        if chat_id:
            chat_session = chats_collection.find_one({'_id': ObjectId(chat_id), 'user_id': current_user_id})
        else:
            chat_session = None
            
        if not chat_session:
            # Create new chat session
            chat_session = {
                'user_id': current_user_id,
                'created_at': datetime.now(timezone.utc),
                'updated_at': datetime.now(timezone.utc),
                'messages': [],
                'title': generate_chat_title(user_message),
                'conversation_memory': []  # Initialize empty conversation memory
            }
            result = chats_collection.insert_one(chat_session)
            chat_id = str(result.inserted_id)
            chat_session['_id'] = result.inserted_id
            
            # Auto-create diary entry for new chat
            auto_create_diary_entry(current_user_id, chat_id)
        
        # Add user message to history
        user_msg = {
            'role': 'user',
            'content': user_message,
            'timestamp': datetime.now(timezone.utc)
        }
        
        # Extract memory information from user message
        memory_info = extract_memory_info(user_message, current_user_id)
        
        # Get user's memory context for personalized responses
        memory_context = get_user_memory_context(current_user_id, user_message)
        
        # Get user's persona context for personalized responses
        persona_context = get_user_persona_context(current_user_id)
        
        # Extract conversation-specific memory
        conversation_memory = extract_conversation_memory(user_message, chat_session.get('messages', []))
        save_conversation_memory(chat_id, conversation_memory)
        
        # Get conversation-specific memory context
        conversation_memory_context = get_conversation_context(chat_session)
        
        # Get user's persona data
        persona_data = personas_collection.find_one({'user_id': current_user_id})
        
        # Get user's feedback history
        user_feedback_history = get_user_feedback_history(current_user_id)
        
        # Get persona-specific response style and cooperation level
        persona_response_style = get_persona_response_style(persona_data, user_feedback_history)
        
        # Multi-level problem solving approach
        try:
            # Build persona-specific prompt additions
            persona_style_prompt = ""
            if persona_data:
                style = persona_response_style['style']
                persona_style_prompt = f"""
                
--- PERSONA RESPONSE STYLE ---
Tone: {style['tone']}
Format: {style['format']}
Approach: {style['approach']}
Avoid: {style['avoid']}

Respond according to these persona characteristics. {persona_response_style['cooperation_instructions']}
"""
            
            # Level 1: Analysis
            analysis_response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPTS["analyzer"] + memory_context + persona_context + conversation_memory_context + persona_style_prompt},
                    {"role": "user", "content": user_message}
                ],
                max_tokens=500,
                temperature=0.7
            )
            analysis = analysis_response.choices[0].message.content
            
            # Level 2: Strategy
            strategy_response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system", 
                        "content": SYSTEM_PROMPTS["strategist"] + memory_context + persona_context + conversation_memory_context + persona_style_prompt
                    },
                    {
                        "role": "user", 
                        "content": f"""Create a strategy based on the analysis below. 
                        Analysis: {analysis}
                        
                        DO NOT START YOUR RESPONSE WITH ANY INTRODUCTORY SENTENCE. Go directly into explaining your strategy as a continuation of the analysis. Do not repeat the analysis in your response."""
                    }
                ],
                max_tokens=1000,
                temperature=0.7
            )
            strategy = strategy_response.choices[0].message.content
            
            # Level 3: Implementation
            implementation_response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {
                        "role": "system", 
                        "content": SYSTEM_PROMPTS["implementer"] + memory_context + persona_context + conversation_memory_context + persona_style_prompt
                    },
                    {
                        "role": "user", 
                        "content": f"""If the user input is relevant with such implementation steps, create implementation steps based on the analysis and strategy below. Else, skip this message.
                        Analysis: {analysis}
                        Strategy: {strategy}
                        
                        DO NOT START YOUR RESPONSE WITH ANY INTRODUCTORY SENTENCE. Go directly into explaining your implementation steps as a continuation of the analysis and strategy. Do not repeat the analysis or strategy in your response."""
                    }
                ],
                max_tokens=1500,
                temperature=0.7
            )
            implementation = implementation_response.choices[0].message.content
            
            # Combine all responses with smooth transitions
            final_response = f"{analysis}\n\n{strategy}\n\n"
            
            # Clean up any remaining redundant phrases
            final_response = final_response.replace("Tabii ki, ", "")
            final_response = final_response.replace("Elbette, ", "")
            final_response = final_response.replace("İşte ", "")
            final_response = final_response.replace("Öncelikle, ", "")
            
        except Exception as e:
            # Fallback to simple response
            simple_response = openai.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a helpful assistant. Provide practical solutions to the user's problems." + memory_context + persona_context + conversation_memory_context + persona_style_prompt},
                    {"role": "user", "content": user_message}
                ],
                max_tokens=1000,
                temperature=0.7
            )
            final_response = simple_response.choices[0].message.content
        
        # Check if user has mentor persona and add YouTube video suggestion
        if persona_data and persona_data.get('role') == 'mentor':
            youtube_video = search_youtube_video(user_message)
            if youtube_video:
                final_response += f"\n\n🎥 **Relevant Video Suggestion:**\n{youtube_video['title']}\n{youtube_video['description']}\n\n[YOUTUBE_VIDEO]{youtube_video['video_id']}[/YOUTUBE_VIDEO]"
        
        # Add assistant response to history
        assistant_msg = {
            'role': 'assistant',
            'content': final_response,
            'timestamp': datetime.now(timezone.utc)
        }
        
        # Update chat session
        chats_collection.update_one(
            {'_id': chat_session['_id']},
            {
                '$push': {'messages': {'$each': [user_msg, assistant_msg]}},
                '$set': {'updated_at': datetime.now(timezone.utc)}
            }
        )
        
        # Auto-update diary entry
        auto_update_diary_entry(current_user_id, chat_id)
        
        return jsonify({
            'message': final_response,
            'chat_id': chat_id
        }), 200
        
    except Exception as e:
        return jsonify({'error': f'Chatbot error: {str(e)}'}), 500

@app.route('/api/chat/history', methods=['GET'])
@jwt_required()
def get_chat_history():
    try:
        current_user_id = get_jwt_identity()
        chats = list(chats_collection.find(
            {'user_id': current_user_id},
            {'messages': 0}  # Exclude messages for list view
        ).sort('updated_at', -1))
        
        # Convert ObjectId to string
        for chat in chats:
            chat['_id'] = str(chat['_id'])
            
        return jsonify({'chats': chats}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat/<chat_id>', methods=['GET'])
@jwt_required()
def get_chat_messages(chat_id):
    try:
        current_user_id = get_jwt_identity()
        chat = chats_collection.find_one({
            '_id': ObjectId(chat_id),
            'user_id': current_user_id
        })
        
        if not chat:
            return jsonify({'error': 'Chat bulunamadı'}), 404
            
        chat['_id'] = str(chat['_id'])
        return jsonify({'chat': chat}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/chat/<chat_id>/memory', methods=['GET'])
@jwt_required()
def get_conversation_memory(chat_id):
    try:
        current_user_id = get_jwt_identity()
        chat_session = chats_collection.find_one({
            '_id': ObjectId(chat_id), 
            'user_id': current_user_id
        })
        
        if not chat_session:
            return jsonify({'error': 'Konuşma bulunamadı'}), 404
        
        conversation_memory = chat_session.get('conversation_memory', [])
        
        return jsonify({
            'success': True,
            'chat_id': chat_id,
            'conversation_memory': conversation_memory,
            'memory_count': len(conversation_memory)
        })
        
    except Exception as e:
        return jsonify({'error': f'Konuşma hafızası alınamadı: {str(e)}'}), 500

@app.route('/api/memory', methods=['GET'])
@jwt_required()
def get_memory():
    try:
        current_user_id = get_jwt_identity()
        memory = memories_collection.find_one({"user_id": current_user_id})
        
        if memory:
            # Remove MongoDB _id field
            memory.pop('_id', None)
            return jsonify({
                'success': True,
                'memory': memory
            })
        else:
            # Return empty memory structure
            return jsonify({
                'success': True,
                'memory': {
                    'user_id': current_user_id,
                    'family_friends': [],
                    'favorites': [],
                    'opinions': [],
                    'skills': [],
                    'personality': [],
                    'health': [],
                    'others': []
                }
            })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/memory', methods=['PUT'])
@jwt_required()
def update_memory():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate memory data structure
        valid_categories = ['family_friends', 'favorites', 'opinions', 'skills', 'personality', 'health', 'others']
        memory_data = {}
        
        for category in valid_categories:
            if category in data and isinstance(data[category], list):
                memory_data[category] = data[category]
        
        if not memory_data:
            return jsonify({'success': False, 'message': 'Geçerli memory verisi bulunamadı'}), 400
        
        # Update or create memory document
        memory_data['user_id'] = current_user_id
        memory_data['updated_at'] = datetime.now(timezone.utc)
        
        existing_memory = memories_collection.find_one({"user_id": current_user_id})
        if existing_memory:
            memories_collection.update_one(
                {"user_id": current_user_id},
                {"$set": memory_data}
            )
        else:
            memory_data['created_at'] = datetime.now(timezone.utc)
            memories_collection.insert_one(memory_data)
        
        return jsonify({'success': True, 'message': 'Memory başarıyla güncellendi'})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/memory/clear', methods=['DELETE'])
@jwt_required()
def clear_memory():
    try:
        current_user_id = get_jwt_identity()
        memories_collection.delete_one({"user_id": current_user_id})
        return jsonify({'success': True, 'message': 'Memory başarıyla temizlendi'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/persona', methods=['GET'])
@jwt_required()
def get_persona():
    try:
        current_user_id = get_jwt_identity()
        persona = personas_collection.find_one({"user_id": current_user_id})
        
        if persona:
            # Remove MongoDB _id field
            persona.pop('_id', None)
            return jsonify({
                'success': True,
                'persona': persona
            })
        else:
            # Return default persona structure
            return jsonify({
                'success': True,
                'persona': {
                    'user_id': current_user_id,
                    'role': 'friend',
                    'backstory': '',
                    'personality_traits': [],
                    'interests': []
                }
            })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/persona', methods=['PUT'])
@jwt_required()
def update_persona():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate persona data
        valid_roles = ['friend', 'boyfriend', 'girlfriend', 'spouse_male', 'spouse_female', 
                      'brother', 'sister', 'mentor', 'advisor', 'academician']
        
        valid_traits = ['Confident', 'Shy', 'Energetic', 'Mellow', 'Caring', 'Sassy', 
                       'Practical', 'Dreamy', 'Artistic', 'Logical']
        
        valid_interests = ['Board games', 'Comics', 'Manga', 'History', 'Philosophy', 
                          'Cooking & Baking', 'Anime', 'Basketball', 'Football', 'Sci-fi', 
                          'Sneakers', 'Gardening', 'Skincare & Makeup', 'Cars', 'Space', 
                          'Soccer', 'K-pop', 'Fitness', 'Physics', 'Mindfulness']
        
        persona_data = {
            'user_id': current_user_id,
            'role': data.get('role', 'friend') if data.get('role') in valid_roles else 'friend',
            'backstory': data.get('backstory', ''),
            'personality_traits': [trait for trait in data.get('personality_traits', []) if trait in valid_traits],
            'interests': [interest for interest in data.get('interests', []) if interest in valid_interests],
            'updated_at': datetime.now(timezone.utc)
        }
        
        # Update or create persona document
        existing_persona = personas_collection.find_one({"user_id": current_user_id})
        if existing_persona:
            personas_collection.update_one(
                {"user_id": current_user_id},
                {"$set": persona_data}
            )
        else:
            persona_data['created_at'] = datetime.now(timezone.utc)
            personas_collection.insert_one(persona_data)
        
        return jsonify({'success': True, 'message': 'AI kişiliği başarıyla güncellendi'})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/persona/reset', methods=['DELETE'])
@jwt_required()
def reset_persona():
    try:
        current_user_id = get_jwt_identity()
        personas_collection.delete_one({"user_id": current_user_id})
        return jsonify({'success': True, 'message': 'AI kişiliği varsayılan ayarlara sıfırlandı'})
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/chat/<chat_id>/message/<message_index>/feedback', methods=['POST'])
@jwt_required()
def add_message_feedback(chat_id, message_index):
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        feedback_type = data.get('feedback_type')  # 'thumbs_up', 'thumbs_down', 'love', 'funny', 'meaningless', 'offensive'
        
        # Validate feedback type
        valid_feedback_types = ['thumbs_up', 'thumbs_down', 'love', 'funny', 'meaningless', 'offensive']
        if feedback_type not in valid_feedback_types:
            return jsonify({'error': 'Geçersiz feedback türü'}), 400
        
        # Find the chat and verify ownership
        chat_session = chats_collection.find_one({
            '_id': ObjectId(chat_id), 
            'user_id': current_user_id
        })
        
        if not chat_session:
            return jsonify({'error': 'Konuşma bulunamadı'}), 404
        
        message_idx = int(message_index)
        messages = chat_session.get('messages', [])
        
        if message_idx >= len(messages):
            return jsonify({'error': 'Mesaj bulunamadı'}), 404
        
        # Update the specific message with feedback
        feedback_data = {
            'type': feedback_type,
            'timestamp': datetime.now(timezone.utc)
        }
        
        # Use dot notation to update specific array element
        chats_collection.update_one(
            {'_id': ObjectId(chat_id)},
            {
                '$set': {
                    f'messages.{message_idx}.user_feedback': feedback_data
                }
            }
        )
        
        return jsonify({
            'success': True,
            'message': 'Feedback has been added successfully',
            'feedback': feedback_data
        })
        
    except Exception as e:
        return jsonify({'error': f'Feedback could not be added: {str(e)}'}), 500

@app.route('/api/chat/<chat_id>/message/<message_index>/feedback', methods=['DELETE'])
@jwt_required()
def remove_message_feedback(chat_id, message_index):
    try:
        current_user_id = get_jwt_identity()
        
        # Find the chat and verify ownership
        chat_session = chats_collection.find_one({
            '_id': ObjectId(chat_id), 
            'user_id': current_user_id
        })
        
        if not chat_session:
            return jsonify({'error': 'Konuşma bulunamadı'}), 404
        
        message_idx = int(message_index)
        messages = chat_session.get('messages', [])
        
        if message_idx >= len(messages):
            return jsonify({'error': 'Mesaj bulunamadı'}), 404
        
        # Remove feedback from the specific message
        chats_collection.update_one(
            {'_id': ObjectId(chat_id)},
            {
                '$unset': {
                    f'messages.{message_idx}.user_feedback': ""
                }
            }
        )
        
        return jsonify({
            'success': True,
            'message': 'Feedback has been removed successfully'
        })
        
    except Exception as e:
        return jsonify({'error': f'Feedback could not be removed: {str(e)}'}), 500

@app.route('/api/diary', methods=['GET'])
@jwt_required()
def get_diary_entries():
    try:
        current_user_id = get_jwt_identity()
        diary_entries = list(diary_collection.find({'user_id': current_user_id}).sort('date', -1))
        
        # Convert ObjectId to string
        for entry in diary_entries:
            entry['_id'] = str(entry['_id'])
        
        return jsonify({'diary_entries': diary_entries}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/diary', methods=['POST'])
@jwt_required()
def create_diary_entry():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        chat_id = data.get('chat_id')
        
        if not chat_id:
            return jsonify({'error': 'Chat ID is required'}), 400
        
        chat_session = chats_collection.find_one({'_id': ObjectId(chat_id), 'user_id': current_user_id})
        
        if not chat_session:
            return jsonify({'error': 'Chat not found'}), 404
        
        diary_summary = summarize_chat_session(chat_session)
        
        if not diary_summary:
            return jsonify({'error': 'Chat summary could not be created'}), 500
        
        diary_entry = {
            'user_id': current_user_id,
            'chat_id': chat_id,
            'title': diary_summary['title'],
            'summary': diary_summary['summary'],
            'date': diary_summary['date'],
            'message_count': diary_summary['message_count'],
            'created_at': datetime.now(timezone.utc)
        }
        
        result = diary_collection.insert_one(diary_entry)
        
        return jsonify({
            'success': True,
            'message': 'Diary entry created successfully',
            'diary_entry': {
                'id': str(result.inserted_id),
                'title': diary_entry['title'],
                'summary': diary_entry['summary'],
                'date': diary_entry['date'],
                'message_count': diary_entry['message_count']
            }
        }), 201
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/diary/<entry_id>', methods=['GET'])
@jwt_required()
def get_diary_entry(entry_id):
    try:
        current_user_id = get_jwt_identity()
        diary_entry = diary_collection.find_one({'_id': ObjectId(entry_id), 'user_id': current_user_id})
        
        if not diary_entry:
            return jsonify({'error': 'Diary entry not found'}), 404
        
        diary_entry['_id'] = str(diary_entry['_id'])
        
        return jsonify({'diary_entry': diary_entry}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/diary/<entry_id>', methods=['DELETE'])
@jwt_required()
def delete_diary_entry(entry_id):
    try:
        current_user_id = get_jwt_identity()
        diary_collection.delete_one({'_id': ObjectId(entry_id), 'user_id': current_user_id})
        
        return jsonify({'success': True, 'message': 'Diary entry deleted successfully'}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# Feedback endpoints
@app.route('/api/feedback', methods=['GET'])
@jwt_required()
def get_feedback():
    try:
        current_user_id = get_jwt_identity()
        feedback = feedback_collection.find_one({"user_id": current_user_id})
        
        if feedback:
            # Remove MongoDB _id field
            feedback.pop('_id', None)
            return jsonify({
                'success': True,
                'feedback': feedback
            })
        else:
            # Return empty feedback structure
            return jsonify({
                'success': True,
                'feedback': {
                    'user_id': current_user_id,
                    'design': 0,
                    'usability': 0,
                    'response_quality': 0,
                    'speed': 0,
                    'personalization': 0,
                    'conversation_naturalness': 0,
                    'usefulness': 0,
                    'overall_satisfaction': '',
                    'created_at': None,
                    'updated_at': None
                }
            })
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/api/feedback', methods=['PUT'])
@jwt_required()
def update_feedback():
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        # Validate required fields
        required_fields = ['design', 'usability', 'response_quality', 'speed', 
                          'personalization', 'conversation_naturalness', 'usefulness', 'overall_satisfaction']
        
        for field in required_fields:
            if field not in data:
                return jsonify({'success': False, 'message': f'Missing field: {field}'}), 400
        
        # Validate rating values (1-5)
        rating_fields = ['design', 'usability', 'response_quality', 'speed', 
                        'personalization', 'conversation_naturalness', 'usefulness']
        
        for field in rating_fields:
            if not isinstance(data[field], int) or data[field] < 1 or data[field] > 5:
                return jsonify({'success': False, 'message': f'{field} must be an integer between 1 and 5'}), 400
        
        # Prepare feedback data
        feedback_data = {
            'user_id': current_user_id,
            'design': data['design'],
            'usability': data['usability'],
            'response_quality': data['response_quality'],
            'speed': data['speed'],
            'personalization': data['personalization'],
            'conversation_naturalness': data['conversation_naturalness'],
            'usefulness': data['usefulness'],
            'overall_satisfaction': data['overall_satisfaction'],
            'updated_at': datetime.now(timezone.utc)
        }
        
        # Check if feedback exists
        existing_feedback = feedback_collection.find_one({"user_id": current_user_id})
        
        if existing_feedback:
            # Update existing feedback
            feedback_collection.update_one(
                {"user_id": current_user_id},
                {"$set": feedback_data}
            )
            message = 'Feedback updated successfully'
        else:
            # Create new feedback
            feedback_data['created_at'] = datetime.now(timezone.utc)
            feedback_collection.insert_one(feedback_data)
            message = 'Feedback created successfully'
        
        return jsonify({'success': True, 'message': message})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port)
