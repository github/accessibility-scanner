require 'rack'
require 'rack/auth/basic'
require 'rack/static'

# Basic authentication middleware
use Rack::Auth::Basic, "Protected Area" do |username, password|
  expected_username = ENV['TEST_USERNAME']
  expected_password = ENV['TEST_PASSWORD']

  # Check if environment variables are set
  if expected_username.nil? || expected_password.nil?
    puts "Warning: TEST_USERNAME and/or TEST_PASSWORD environment variables not set"
    false
  else
    username == expected_username && password == expected_password
  end
end

# Serve static files from _site directory
use Rack::Static,
  urls: %w[/],
  root: File.expand_path('_site', __dir__),
  index: 'index.html'

# Fallback for requests that don't match static files
run lambda { |env|
  path = env['PATH_INFO']
  
  # Try to serve the requested file
  file_path = File.join(File.expand_path('_site', __dir__), path)
  
  # If it's a directory, try to serve index.html
  if File.directory?(file_path)
    index_path = File.join(file_path, 'index.html')
    if File.exist?(index_path)
      [200, {'Content-Type' => 'text/html'}, [File.read(index_path)]]
    else
      [404, {'Content-Type' => 'text/html'}, [File.read(File.join(File.expand_path('_site', __dir__), '404.html'))]]
    end
  elsif File.exist?(file_path)
    content_type = case File.extname(file_path)
                   when '.html' then 'text/html'
                   when '.css' then 'text/css'
                   when '.js' then 'application/javascript'
                   when '.xml' then 'application/xml'
                   else 'text/plain'
                   end
    [200, {'Content-Type' => content_type}, [File.read(file_path)]]
  else
    # Serve 404 page
    [404, {'Content-Type' => 'text/html'}, [File.read(File.join(File.expand_path('_site', __dir__), '404.html'))]]
  end
}