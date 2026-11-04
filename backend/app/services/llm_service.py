try:
    from langchain_community.chat_models import ChatOpenAI
except ImportError:
    # Fallback for older versions
    from langchain.chat_models import ChatOpenAI

from langchain_core.prompts import ChatPromptTemplate, PromptTemplate
from langchain_core.messages import HumanMessage, SystemMessage, AIMessage
from typing import Dict, List, Any, Optional
import time
import json
import re
import asyncio
from collections import OrderedDict
from copy import deepcopy
from ..core.config import settings
from .ollama_service import ollama_service
from .grammar_analyzer import (sanitize_grammar_analysis, deterministic_grammar_analysis,
                               grammar_generation_prompt, grammar_analysis_is_valid, grounded_model_analysis)
from .grammar_grounded import partial_analysis
from .chat_prompt import CHAT_SYSTEM_PROMPT, build_chat_system_prompt


class JapaneseLearningService:
    def __init__(self):
        self.provider = settings.llm_provider
        self._grammar_analysis_cache = OrderedDict()

        if self.provider == "ollama":
            self.service = ollama_service
        else:
            # Fallback to OpenAI
            self.llm = ChatOpenAI(
                openai_api_key=settings.openai_api_key,
                model_name="gpt-3.5-turbo",
                temperature=0.7,
                max_tokens=1000
            )
            self.grammar_llm = ChatOpenAI(
                openai_api_key=settings.openai_api_key,
                model_name="gpt-3.5-turbo",
                temperature=0,
                max_tokens=1000,
            )
            self._setup_prompts()

    def _setup_prompts(self):
        """Setup all the prompt templates."""

        # Chat prompt for general Q&A
        self.chat_prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content=CHAT_SYSTEM_PROMPT),
            HumanMessage(content="{question}")
        ])

        # Grammar analysis prompt
        self.grammar_prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content="""You are SenpaiAI, a Japanese grammar expert for Vietnamese learners.
            Analyze only the given Japanese text. Never invent meanings. If a word is uncertain, write "Chưa chắc chắn về từ này".
            When Vietnamese is requested, write every explanation, vocabulary meaning, sentence meaning, and suggestion in Vietnamese. Never return English prose. Keep Japanese grammar forms and example sentences in Japanese.
            Do not treat vocabulary items as grammar patterns.
            Return only essential grammar patterns that actually occur in the input. Use each pattern's canonical textbook form, order patterns by their first occurrence, remove duplicate or equivalent patterns, and return at most 6.
            If Vietnamese is requested, use Vietnamese for all explanations and suggestions. Do not use English unless requested.
            Difficulty score must match JLPT level: N5 simple questions 2-3/10, N4 4/10, N3 5-6/10, N2 7-8/10, N1 9-10/10.

            Format your response as JSON with these fields:
            - sentence_meaning: string
            - vocabulary: array of objects with 'term', 'meaning', 'jlpt_level'
            - grammar_patterns: array of objects with 'pattern', 'explanation', 'example'
            - grammar_points: same array as grammar_patterns
            - jlpt_level: string
            - difficulty_score: number
            - suggestions: array of Japanese-learning suggestions related to the text"""),
            HumanMessage(content="Vietnamese requested: {include_vietnamese}\nAnalyze this Japanese text: {text}")
        ])

        # Translation prompt
        self.translation_prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content="""You are a professional Japanese-Vietnamese translator.
            Provide accurate, natural translations while preserving the original meaning and tone.
            For Japanese to Vietnamese: output Vietnamese only. Do not include English headings or explanations.
            For Vietnamese to Japanese: Provide natural Japanese that sounds native.
            Include pronunciation guides (romaji) for Japanese text when helpful."""),
            HumanMessage(content="Translate this {source_lang} text to {target_lang}: {text}")
        ])

        # JLPT level prediction prompt
        self.jlpt_prompt = ChatPromptTemplate.from_messages([
            SystemMessage(content="""You are a JLPT level assessment expert. 
            Analyze Japanese text and determine the appropriate JLPT level (N5, N4, N3, N2, N1).
            Consider vocabulary difficulty, grammar complexity, and kanji usage.
            Respond with just the JLPT level (e.g., "N3")."""),
            HumanMessage(content="What JLPT level is this text: {text}")
        ])

    async def chat_response(
            self,
            question: str,
            context: Optional[str] = None,
            jlpt_level: Optional[str] = None,
            response_language: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate a chat response with RAG context."""
        if self.provider == "ollama":
            return await self.service.chat_response(question, context, jlpt_level, response_language=response_language)

        # OpenAI implementation
        start_time = time.time()

        try:
            # Prepare the question with context
            if context:
                enhanced_question = f"Context: {context}\n\nQuestion: {question}"
            else:
                enhanced_question = question

            # Add JLPT level context if provided
            if jlpt_level:
                enhanced_question = f"User's JLPT level: {jlpt_level}\n\n{enhanced_question}"

            # Generate response
            messages = [SystemMessage(content=build_chat_system_prompt(response_language or 'vi')), HumanMessage(content=enhanced_question)]
            response = await self.llm.agenerate([messages])

            answer = response.generations[0][0].text.strip()

            # Predict JLPT level of the response
            jlpt_prediction = await self.predict_jlpt_level(answer)

            response_time = time.time() - start_time

            return {
                "answer": answer,
                "jlpt_level": jlpt_prediction,
                "response_time": response_time
            }

        except Exception as e:
            return {
                "answer": f"Xin lỗi, mình gặp lỗi khi xử lý câu hỏi: {str(e)}",
                "jlpt_level": None,
                "response_time": time.time() - start_time
            }

    async def voice_completion(self, system_prompt: str, prompt: str) -> str:
        """Run a purpose-built voice conversation prompt without changing regular chat."""
        if self.provider == "ollama":
            return await asyncio.to_thread(self.service._call_ollama, prompt, system_prompt)
        messages = [SystemMessage(content=system_prompt), HumanMessage(content=prompt)]
        response = await self.llm.agenerate([messages])
        return response.generations[0][0].text.strip()

    async def analyze_grammar(self, text: str, include_vietnamese: bool = False,
                              response_language: Optional[str] = None) -> Dict[str, Any]:
        language = response_language or ('vi' if include_vietnamese else 'en')
        text = text.strip()
        cache_key = (" ".join(text.split()), language, 'grounded-v3')
        if cache_key in self._grammar_analysis_cache:
            self._grammar_analysis_cache.move_to_end(cache_key)
            return deepcopy(self._grammar_analysis_cache[cache_key])

        reviewed = deterministic_grammar_analysis(text, response_language=language)
        if reviewed is not None:
            self._cache_grammar_analysis(cache_key, reviewed)
            return deepcopy(reviewed)

        last_error = None
        for _attempt in range(2):
            try:
                if self.provider == 'ollama':
                    raw = await self.service.analyze_grammar(text, response_language=language, repair_language=bool(_attempt))
                else:
                    system, prompt = grammar_generation_prompt(text, language)
                    response = await self.grammar_llm.agenerate([[SystemMessage(content=system), HumanMessage(content=prompt)]])
                    raw = json.loads(response.generations[0][0].text.strip())
                if not isinstance(raw, dict) or raw.get('jlpt_level') not in {'N5', 'N4', 'N3', 'N2', 'N1'}:
                    raise ValueError('invalid_grammar_analysis')
                analysis = grounded_model_analysis(text, raw, language)
                if not grammar_analysis_is_valid(analysis, language):
                    raise ValueError('invalid_grammar_language')
                analysis['translation'] = None
                self._cache_grammar_analysis(cache_key, analysis)
                return deepcopy(analysis)
            except Exception as error:
                last_error = error
        # Do not cache a fabricated N3 result or an error message as analysis.
        partial = partial_analysis(text, language)
        if partial is not None:
            # Do not cache partial results: a later request should be allowed
            # to obtain a complete analysis when generation succeeds.
            return partial
        raise RuntimeError('grammar_analysis_failed') from last_error

    def _cache_grammar_analysis(self, key: tuple, result: Dict[str, Any]) -> None:
        self._grammar_analysis_cache[key] = deepcopy(result)
        self._grammar_analysis_cache.move_to_end(key)
        while len(self._grammar_analysis_cache) > 256:
            self._grammar_analysis_cache.popitem(last=False)

    async def translate_text(
            self,
            text: str,
            source_lang: str,
            target_lang: str
    ) -> Dict[str, Any]:
        """Translate text between Japanese and Vietnamese."""
        if self.provider == "ollama":
            return await self.service.translate_text(text, source_lang, target_lang)

        # OpenAI implementation
        try:
            messages = self.translation_prompt.format_messages(
                text=text,
                source_lang=source_lang,
                target_lang=target_lang
            )
            response = await self.llm.agenerate([messages])

            translated_text = response.generations[0][0].text.strip()

            return {
                "original_text": text,
                "translated_text": translated_text,
                "source_lang": source_lang,
                "target_lang": target_lang,
                "confidence": 0.9  # Placeholder confidence score
            }

        except Exception as e:
            return {
                "original_text": text,
                "translated_text": f"Translation error: {str(e)}",
                "source_lang": source_lang,
                "target_lang": target_lang,
                "confidence": 0.0
            }

    async def predict_jlpt_level(self, text: str) -> str:
        """Predict the JLPT level of Japanese text."""
        if self.provider == "ollama":
            return await self.service.predict_jlpt_level(text)

        # OpenAI implementation
        try:
            messages = self.jlpt_prompt.format_messages(text=text)
            response = await self.llm.agenerate([messages])

            level = response.generations[0][0].text.strip()

            # Validate JLPT level format
            if re.match(r'^N[1-5]$', level):
                return level
            else:
                return "N3"  # Default fallback

        except Exception as e:
            return "N3"  # Default fallback

    async def generate_learning_suggestions(
            self,
            user_level: str,
            weak_areas: List[str]
    ) -> List[str]:
        """Generate personalized learning suggestions."""
        if self.provider == "ollama":
            return await self.service.generate_learning_suggestions(user_level, weak_areas)

        # OpenAI implementation
        try:
            prompt = f"""Based on the user's JLPT level ({user_level}) and weak areas ({', '.join(weak_areas)}), 
            provide 5 specific learning suggestions. Focus on practical, actionable advice."""

            messages = [HumanMessage(content=prompt)]
            response = await self.llm.agenerate([messages])

            suggestions_text = response.generations[0][0].text.strip()

            # Split into individual suggestions
            suggestions = [s.strip() for s in suggestions_text.split('\n') if s.strip()]
            return suggestions[:5]  # Limit to 5 suggestions

        except Exception as e:
            return [f"Error generating suggestions: {str(e)}"]


# Global instance
japanese_service = JapaneseLearningService()
