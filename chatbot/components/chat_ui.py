import streamlit as st

from utils.gemini_client import stream_reply


def render_chat_interface(context_article=None):
    if "messages" not in st.session_state:
        st.session_state.messages = [
            {"role": "assistant", "content": "Hello! I am your AI News Assistant. Ask me anything about today's articles!"}
        ]

    if context_article:
        st.info(f"Reading Context: **{context_article.get('title')}**")

    for message in st.session_state.messages:
        with st.chat_message(message["role"]):
            st.markdown(message["content"])

    if prompt := st.chat_input("Ask a question about the news..."):
        st.session_state.messages.append({"role": "user", "content": prompt})
        with st.chat_message("user"):
            st.markdown(prompt)

        with st.chat_message("assistant"):
            reply = st.write_stream(stream_reply(prompt, context_article))
            st.session_state.messages.append({"role": "assistant", "content": reply})
