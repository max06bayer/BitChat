<script>
  export let message;
  let liked = Math.random() >= 0.8;

  let senderName = message["sender-name"];
  let senderId = message["sender-id"];
  let senderAvatar = message["sender-avatar"];
  let messageId = message["message-id"];
  let text = message["message"];
  let time = message["message-time"];
  let attachments = message["message-attachments"];
  let likes = message["message-reactions"].likes;
  let comments = message["message-reactions"].comments;

  function formatDate(isoTime) {
    const date = new Date(isoTime);
    return date.toLocaleDateString(); // Only date
  }
</script>

<div class="message-container">
  <img class="avatar" src={senderAvatar} alt="{senderName}'s avatar" />

  <div class="message-content">
    <div class="header">
      <span class="name">{senderName}</span>
    </div>

    <div class="text">{text}</div>

    <div class="reactions-row">
      <div class="reactions">
        <img
          src={liked ? "like-active.svg" : "like-inactive.svg"}
          alt="Like"
          class="like"
        />
        {likes}
        <img src="comment.svg" alt="Comment" class="comment" />
        {comments}
        <img src="share.svg" alt="Comment" class="comment" />
      </div>

      <span class="time">{formatDate(time)}</span>
    </div>
  </div>
</div>

<style>
  .message-container {
    display: flex;
    align-items: flex-start;
    padding: 0.5rem;
    gap: 1.5rem;
    background-color: #111;
    color: white;
    font-family: "Questrial", sans-serif;
  }

  .avatar {
    width: 48px;
    height: 48px;
    object-fit: cover;
    border-radius: 50%;
    border: 1px solid #505050;
  }

  .message-content {
    margin-top: -0.2rem;
    flex: 1;
  }

  .header {
    letter-spacing: -0.7px;
    font-size: 0.9rem;
    color: #ccc;
    margin-bottom: 0.3rem;
  }

  .name {
    font-family: "Poppins", sans-serif;
    font-weight: 700;
    color: #fff;
    font-size: 16px;
  }

  .text {
    font-size: 1rem;
    margin-bottom: 0.5rem;
    line-height: 1.4;
  }

  .reactions-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .reactions {
    font-size: 1rem;
    color: #999;
  }

  .like,
  .comment {
    width: 20px;
    margin-bottom: -0.3rem;
    margin-right: 0.4rem;
  }

  .comment {
    margin-left: 0.5rem;
  }

  .time {
    font-size: 1rem;
    color: #777;
  }
</style>
