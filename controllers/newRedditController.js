export async function processRedditData(req, res) {
    try {
      const { keyword } = req.body;
  
      if (!keyword || typeof keyword !== 'string') {
        return res.status(400).json({ 
          success: false, 
          error: 'Invalid or missing keyword parameter' 
        });
      }
  
      console.log("1. Received keyword:", keyword);
      console.log("-------------------------------------------");
  
      // More detailed User-Agent string
  
      // Authentication step
      const authUrl = "https://www.reddit.com/api/v1/access_token";
      const clientId = "d5obcD-quM8Cfo4qsCBF3Q";
      const clientSecret = "u0XL0qJRCw-n4ioICLIh84R-SprJxQ";
      const authString = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  
      console.log("Attempting authentication...");
  
      const authResponse = await fetch(authUrl, {
        method: "POST",
        headers: {
          Authorization: `Basic ${authString}`,
          "Content-Type": "application/x-www-form-urlencoded",
          'User-Agent': 'topfeed/1.0.0 (by u/Prestigious-Cow9705)',
          "Accept": "*/*",
          "Connection": "keep-alive"
        },
        body: "grant_type=client_credentials",
      });
  
      const authData = await authResponse.json();
      if (!authResponse.ok) {
        console.error("Failed to authenticate:", authData);
        throw new Error(`Authentication failed: ${authData.error}`);
      }
  
      const accessToken = authData.access_token;
      console.log("2. Successfully authenticated");
  
      // Add a small delay
      await new Promise(resolve => setTimeout(resolve, 2000));
  
      // Build search URL with proper encoding
      const searchParams = new URLSearchParams({
        q: keyword,
        sort: 'relevance',
        limit: '100',
        t: 'year',
        raw_json: '1'
      });
  
      const searchUrl = `https://oauth.reddit.com/search?${searchParams.toString()}`;
      console.log("3. Search URL:", searchUrl);
  
      // Log request details
      const requestHeaders = {
        'Authorization': `Bearer ${accessToken}`,
        'User-Agent': 'test',
        'Accept': 'application/json',
        'Connection': 'keep-alive',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      };
  
      console.log("Request headers:", {
        ...requestHeaders,
        'Authorization': 'Bearer [token]' // Hide actual token in logs
      });
  
      const searchResponse = await fetch(searchUrl, {
        headers: requestHeaders
      });
  
      console.log("4. Search Response Status:", searchResponse.status);
      console.log("Response headers:", Object.fromEntries(searchResponse.headers));
  
      if (!searchResponse.ok) {
        const errorText = await searchResponse.text();
        console.error("Error response:", errorText);
        
        if (searchResponse.status === 429) {
          return res.status(429).json({
            success: false,
            error: 'Rate limit exceeded. Please try again later.'
          });
        }
        
        throw new Error(`Reddit API returned ${searchResponse.status}`);
      }
  
      const data = await searchResponse.json();
  
      if (!data?.data?.children) {
        throw new Error('Unexpected API response structure');
      }
  
      const processedPosts = data.data.children
        .filter((post) => {
          if (!post?.data) return false;
  
          const {
            subreddit_subscribers,
            subreddit_type,
            created_utc,
            title
          } = post.data;
  
          const createdDate = new Date(created_utc * 1000);
          const oneYearAgo = new Date();
          oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  
          return (
            subreddit_type === "public" &&
            subreddit_subscribers >= 10000 &&
            createdDate > oneYearAgo &&
            title?.length > 0
          );
        })
        .slice(0, 20)
        .map((post) => ({
          id: post.data.id,
          title: post.data.title,
          subreddit: post.data.subreddit,
          url: `https://reddit.com${post.data.permalink}`,
          score: post.data.score,
          num_comments: post.data.num_comments,
          created_utc: post.data.created_utc,
          subscriber_count: post.data.subreddit_subscribers,
          selftext: post.data.selftext?.substring(0, 1000) || '',
          author: post.data.author,
        }));
  
      console.log("5. Processed posts count:", processedPosts.length);
  
      res.status(200).json({
        success: true,
        data: processedPosts,
        message: `Successfully processed ${processedPosts.length} Reddit posts for keyword: ${keyword}`,
      });
    } catch (error) {
      console.error("Error in API route:", error);
      
      res.status(500).json({ 
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      });
    }
  }